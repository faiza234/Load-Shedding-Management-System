// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { userRepository } = require("../repositories");
const { signToken, requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// POST /api/auth/login  { user_name, password }
router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { user_name, password } = req.body;
    if (!user_name || !password) {
      return res.status(400).json({ error: "user_name and password are required." });
    }

    const user = await userRepository.findByUsername(user_name);
    if (!user) return res.status(401).json({ error: "Invalid username or password." });

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid username or password." });

    const token = signToken(user);
    res.json({
      token,
      user: {
        user_id: user.user_id,
        user_name: user.user_name,
        role: user.role,
        contact_email: user.contact_email,
        assigned_areas: user.assigned_areas || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register (or /api/auth/create-account)
router.post(["/register", "/create-account"], async (req, res, next) => {
  try {
    const { user_name, password, contact_email, role, area_ids, area_id } = req.body;
    if (!user_name || !password) {
      return res.status(400).json({ error: "user_name and password are required." });
    }

    const existing = await userRepository.findByUsername(user_name);
    if (existing) {
      return res.status(409).json({ error: "Username already exists." });
    }

    const user = await userRepository.create({
      user_name,
      password,
      contact_email,
      role: role || "officer",
      area_ids,
      area_id,
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  - verify current token / fetch profile
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await userRepository.findById(req.user.user_id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;


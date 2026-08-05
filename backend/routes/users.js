// routes/users.js
const express = require("express");
const { userRepository } = require("../repositories");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/users - List all authority users
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const users = await userRepository.findAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id - Get specific authority user
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const user = await userRepository.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/users - Create new authority user / officer account (Admin only)
router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
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
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

// --- SUB-RESOURCE ROUTES (Must come before generic /:id routes) ---

// POST /api/users/:id/areas - Assign an area (or list of areas) to authority user (Admin only)
router.post("/:id/areas", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { area_id, area_ids } = req.body;
    let areas;
    if (Array.isArray(area_ids)) {
      for (const aId of area_ids) {
        areas = await userRepository.assignArea(req.params.id, aId);
      }
    } else if (area_id) {
      areas = await userRepository.assignArea(req.params.id, area_id);
    } else {
      return res.status(400).json({ error: "area_id or area_ids array is required." });
    }
    res.json({ user_id: Number(req.params.id), assigned_areas: areas });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id/areas - Replace/set full list of assigned areas for authority user (Admin only)
router.put("/:id/areas", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { area_ids } = req.body;
    if (!Array.isArray(area_ids)) {
      return res.status(400).json({ error: "area_ids array is required." });
    }
    const areas = await userRepository.setAreas(req.params.id, area_ids);
    res.json({ user_id: Number(req.params.id), assigned_areas: areas });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id/areas/:area_id - Remove area assignment from authority user (Admin only)
router.delete("/:id/areas/:area_id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const areas = await userRepository.removeArea(req.params.id, req.params.area_id);
    res.json({ user_id: Number(req.params.id), assigned_areas: areas });
  } catch (err) {
    next(err);
  }
});

// --- GENERIC USER PARAMETER ROUTES ---

// GET /api/users/:id - Get specific authority user
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const user = await userRepository.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id - Update authority user details / area assignments (Admin only)
router.put("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { user_name, password, contact_email, role, area_ids } = req.body;
    const updated = await userRepository.update(req.params.id, {
      user_name,
      password,
      contact_email,
      role,
      area_ids,
    });
    if (!updated) return res.status(404).json({ error: "User not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id - Delete authority user (Admin only)
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const deleted = await userRepository.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "User not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;



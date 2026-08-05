// routes/users.js
const express = require("express");
const { userRepository } = require("../repositories");
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validator");

const router = express.Router();
const VALID_ROLES = ["admin", "officer"];

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const users = await userRepository.findAll();
    res.json(users);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { user_name, password, contact_email, role, area_ids, area_id } = req.body;
    if (!user_name || !password) {
      return res.status(400).json({ error: "user_name and password are required." });
    }
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "role must be admin or officer." });
    }

    const existing = await userRepository.findByUsername(user_name);
    if (existing) return res.status(409).json({ error: "Username already exists." });

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

// Sub-resource routes must come before /:id.
router.get("/:id/areas", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const areas = await userRepository.getUserAreas(req.params.id);
    res.json(areas);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/areas", requireAuth, requireRole("admin"), validateIdParam("id"), async (req, res, next) => {
  try {
    const { area_id, area_ids } = req.body;
    let areas = [];

    if (Array.isArray(area_ids)) {
      areas = await userRepository.setAreas(req.params.id, area_ids);
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

router.put("/:id/areas", requireAuth, requireRole("admin"), validateIdParam("id"), async (req, res, next) => {
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

router.delete("/:id/areas/:area_id", requireAuth, requireRole("admin"), validateIdParam("id"), async (req, res, next) => {
  try {
    const areas = await userRepository.removeArea(req.params.id, req.params.area_id);
    res.json({ user_id: Number(req.params.id), assigned_areas: areas });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const user = await userRepository.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAuth, requireRole("admin"), validateIdParam("id"), async (req, res, next) => {
  try {
    const { user_name, password, contact_email, role, area_ids } = req.body;
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "role must be admin or officer." });
    }

    if (user_name) {
      const existing = await userRepository.findByUsername(user_name);
      if (existing && Number(existing.user_id) !== Number(req.params.id)) {
        return res.status(409).json({ error: "Username already exists." });
      }
    }

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

router.delete("/:id", requireAuth, requireRole("admin"), validateIdParam("id"), async (req, res, next) => {
  try {
    if (Number(req.params.id) === Number(req.user.user_id)) {
      return res.status(400).json({ error: "You cannot delete the account currently signed in." });
    }
    const deleted = await userRepository.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "User not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
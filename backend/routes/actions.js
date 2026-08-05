// routes/actions.js
const express = require("express");
const { actionRepository } = require("../repositories");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/actions?area_id=&complaint_id=
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { area_id, complaint_id } = req.query;
    const actions = await actionRepository.findAll({ area_id, complaint_id });
    res.json(actions);
  } catch (err) {
    next(err);
  }
});

// POST /api/actions  (auth required)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { area_id, action_type, notes, complaint_id } = req.body;
    if (!area_id || !action_type) {
      return res.status(400).json({ error: "area_id and action_type are required." });
    }

    const action = await actionRepository.create({
      user_id: req.user.user_id,
      area_id,
      action_type,
      notes,
      complaint_id,
    });
    res.status(201).json(action);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

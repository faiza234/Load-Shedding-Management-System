// routes/actions.js
const express = require("express");
const { actionRepository } = require("../repositories");
const { requireAuth } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validator");

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const actions = await actionRepository.findAll(req.query);
    res.json(actions);
  } catch (err) {
    next(err);
  }
});

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

router.put("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const action = await actionRepository.update(req.params.id, req.body);
    if (!action) return res.status(404).json({ error: "Authority action not found." });
    res.json(action);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const deleted = await actionRepository.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Authority action not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
// routes/schedules.js
const express = require("express");
const { scheduleRepository } = require("../repositories");
const { requireAuth } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validator");

const router = express.Router();

// GET /api/schedules?area_id=&from=&to=
router.get("/", async (req, res, next) => {
  try {
    const { area_id, from, to } = req.query;
    const schedules = await scheduleRepository.findAll({ area_id, from, to });
    res.json(schedules);
  } catch (err) {
    next(err);
  }
});

// GET /api/schedules/:id
router.get("/:id", validateIdParam("id"), async (req, res, next) => {
  try {
    const schedule = await scheduleRepository.findById(req.params.id);
    if (!schedule) return res.status(404).json({ error: "Schedule not found." });
    res.json(schedule);
  } catch (err) {
    next(err);
  }
});

// POST /api/schedules  (auth required)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { area_id, schedule_date, start_time, end_time, duration_hours, reason } = req.body;
    if (!area_id || !schedule_date || !start_time || !end_time) {
      return res.status(400).json({ error: "area_id, schedule_date, start_time and end_time are required." });
    }

    const schedule = await scheduleRepository.create({
      area_id,
      schedule_date,
      start_time,
      end_time,
      duration_hours,
      reason,
      created_by: req.user.user_id,
    });
    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
});

// PUT /api/schedules/:id  (auth required)
router.put("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const updated = await scheduleRepository.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Schedule not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/schedules/:id (auth required)
router.delete("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const deleted = await scheduleRepository.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Schedule not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
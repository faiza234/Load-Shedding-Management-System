// routes/citizens.js
const express = require("express");
const { citizenRepository } = require("../repositories");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/citizens?area_id=&search=
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { area_id, search } = req.query;
    const citizens = await citizenRepository.findAll({ area_id, search });
    res.json(citizens);
  } catch (err) {
    next(err);
  }
});

// POST /api/citizens  - register a citizen
router.post("/", async (req, res, next) => {
  try {
    const { full_name, phone, email, area_id } = req.body;
    if (!full_name || !area_id) {
      return res.status(400).json({ error: "full_name and area_id are required." });
    }
    const citizen = await citizenRepository.create({ full_name, phone, email, area_id });
    res.status(201).json(citizen);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

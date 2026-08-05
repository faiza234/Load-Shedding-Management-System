// routes/analytics.js
const express = require("express");
const { analyticsRepository } = require("../repositories");
const { requireAuth } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validator");

const router = express.Router();
const VALID_RISK_LEVELS = ["Low", "Medium", "High", "Critical"];
const VALID_IMPROVEMENT = ["improved", "stable", "worsened"];

// ---------------------------------------------------------------------------
// Monthly analysis
// ---------------------------------------------------------------------------
router.get("/monthly", async (req, res, next) => {
  try {
    const rows = await analyticsRepository.getMonthlyAnalysis(req.query);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/monthly", requireAuth, async (req, res, next) => {
  try {
    const {
      area_id,
      month,
      year,
      outage_percentage,
      avg_daily_hours,
      total_outages,
      improvement_status,
    } = req.body;

    if (!area_id || !month || !year || outage_percentage === undefined || avg_daily_hours === undefined || total_outages === undefined) {
      return res.status(400).json({ error: "All monthly analysis fields are required." });
    }
    if (Number(month) < 1 || Number(month) > 12) {
      return res.status(400).json({ error: "month must be between 1 and 12." });
    }
    if (improvement_status && !VALID_IMPROVEMENT.includes(improvement_status)) {
      return res.status(400).json({ error: "Invalid improvement_status." });
    }

    const row = await analyticsRepository.createMonthlyAnalysis(req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.put("/monthly/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    if (req.body.month !== undefined && (Number(req.body.month) < 1 || Number(req.body.month) > 12)) {
      return res.status(400).json({ error: "month must be between 1 and 12." });
    }
    if (req.body.improvement_status && !VALID_IMPROVEMENT.includes(req.body.improvement_status)) {
      return res.status(400).json({ error: "Invalid improvement_status." });
    }

    const row = await analyticsRepository.updateMonthlyAnalysis(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: "Monthly analysis record not found." });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete("/monthly/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const deleted = await analyticsRepository.deleteMonthlyAnalysis(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Monthly analysis record not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// High-risk zones
// ---------------------------------------------------------------------------
router.get("/high-risk", async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const all = req.query.all === "1" || req.query.all === "true" || req.query.scope === "all";
    const rows = await analyticsRepository.getHighRiskZones({ year, month, all });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/high-risk", requireAuth, async (req, res, next) => {
  try {
    const { area_id, risk_level } = req.body;
    if (!area_id || !risk_level) {
      return res.status(400).json({ error: "area_id and risk_level are required." });
    }
    if (!VALID_RISK_LEVELS.includes(risk_level)) {
      return res.status(400).json({ error: "Invalid risk_level." });
    }

    const row = await analyticsRepository.createHighRiskZone(req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.put("/high-risk/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    if (req.body.risk_level && !VALID_RISK_LEVELS.includes(req.body.risk_level)) {
      return res.status(400).json({ error: "Invalid risk_level." });
    }
    const row = await analyticsRepository.updateHighRiskZone(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: "High-risk zone not found." });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete("/high-risk/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const deleted = await analyticsRepository.deleteHighRiskZone(req.params.id);
    if (!deleted) return res.status(404).json({ error: "High-risk zone not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Daily frequency
// ---------------------------------------------------------------------------
router.get("/daily", async (req, res, next) => {
  try {
    const all = req.query.all === "1" || req.query.all === "true";
    const rows = await analyticsRepository.getDailyFrequency({ ...req.query, all });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/daily", requireAuth, async (req, res, next) => {
  try {
    const { area_id, date, outage_count, total_outage_hours } = req.body;
    if (!area_id || !date || outage_count === undefined || total_outage_hours === undefined) {
      return res.status(400).json({ error: "area_id, date, outage_count and total_outage_hours are required." });
    }
    if (Number(outage_count) < 0 || Number(total_outage_hours) < 0) {
      return res.status(400).json({ error: "Outage values cannot be negative." });
    }
    const row = await analyticsRepository.createDailyFrequency(req.body);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.put("/daily/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    if (req.body.outage_count !== undefined && Number(req.body.outage_count) < 0) {
      return res.status(400).json({ error: "outage_count cannot be negative." });
    }
    if (req.body.total_outage_hours !== undefined && Number(req.body.total_outage_hours) < 0) {
      return res.status(400).json({ error: "total_outage_hours cannot be negative." });
    }
    const row = await analyticsRepository.updateDailyFrequency(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: "Daily frequency record not found." });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete("/daily/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const deleted = await analyticsRepository.deleteDailyFrequency(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Daily frequency record not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const summary = await analyticsRepository.getSummaryMetrics();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
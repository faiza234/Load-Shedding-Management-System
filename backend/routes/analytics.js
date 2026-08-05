// routes/analytics.js
// -----------------------------------------------------------------------------
// Read-heavy endpoints that power the charts on the dashboard:
//   /api/analytics/monthly       -> Monthly_Analysis rows
//   /api/analytics/high-risk     -> High_Risk_Zone rows (current or given month)
//   /api/analytics/daily         -> Daily_Frequency rows (last N days)
//   /api/analytics/summary       -> quick counts for the overview cards
// Uses AnalyticsRepository for performance-optimized batch querying.
// -----------------------------------------------------------------------------
const express = require("express");
const { analyticsRepository } = require("../repositories");

const router = express.Router();

// GET /api/analytics/monthly?area_id=&year=&month=
router.get("/monthly", async (req, res, next) => {
  try {
    const { area_id, year, month } = req.query;
    const rows = await analyticsRepository.getMonthlyAnalysis({ area_id, year, month });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const { requireAuth } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validator");

// GET /api/analytics/high-risk?year=&month=
router.get("/high-risk", async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const rows = await analyticsRepository.getHighRiskZones({ year, month });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/analytics/high-risk (auth required)
router.post("/high-risk", requireAuth, async (req, res, next) => {
  try {
    const { area_id, month, year, risk_level, flagged_reason, flagged_date } = req.body;
    if (!area_id || !risk_level) {
      return res.status(400).json({ error: "area_id and risk_level are required." });
    }

    const now = new Date();
    const m = month || (now.getMonth() + 1);
    const y = year || now.getFullYear();

    const zone = await analyticsRepository.createHighRiskZone({
      area_id,
      month: m,
      year: y,
      risk_level,
      flagged_reason,
      flagged_date,
    });

    res.status(201).json(zone);
  } catch (err) {
    next(err);
  }
});

// PUT /api/analytics/high-risk/:id (auth required)
router.put("/high-risk/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const updated = await analyticsRepository.updateHighRiskZone(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "High Risk Zone entry not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/analytics/high-risk/:id (auth required)
router.delete("/high-risk/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const deleted = await analyticsRepository.deleteHighRiskZone(req.params.id);
    if (!deleted) return res.status(404).json({ error: "High Risk Zone entry not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/daily?area_id=&days=30
router.get("/daily", async (req, res, next) => {
  try {
    const { area_id, days } = req.query;
    const rows = await analyticsRepository.getDailyFrequency({ area_id, days });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/summary  - counts for overview cards
router.get("/summary", async (req, res, next) => {
  try {
    const summary = await analyticsRepository.getSummaryMetrics();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

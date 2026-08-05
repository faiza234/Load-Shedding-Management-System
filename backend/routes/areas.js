// routes/areas.js
// -----------------------------------------------------------------------------
// Full CRUD for the "Area" table (the 64 districts).
// Uses AreaRepository for all database queries.
// Reading the list is public; creating/editing/deleting requires an
// authenticated authority user.
// -----------------------------------------------------------------------------
const express = require("express");
const { areaRepository } = require("../repositories");
const { requireAuth } = require("../middleware/auth");
const { validateIdParam } = require("../middleware/validator");

const router = express.Router();

// GET /api/areas?division=&region_type=&search=
router.get("/", async (req, res, next) => {
  try {
    const { division, region_type, search } = req.query;
    const rows = await areaRepository.findAll({ division, region_type, search });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/areas/meta/divisions  - distinct list, handy for dropdown filters
router.get("/meta/divisions", async (req, res, next) => {
  try {
    const divisions = await areaRepository.findDivisions();
    res.json(divisions);
  } catch (err) {
    next(err);
  }
});

// GET /api/areas/:id
router.get("/:id", validateIdParam("id"), async (req, res, next) => {
  try {
    const area = await areaRepository.findById(req.params.id);
    if (!area) return res.status(404).json({ error: "Area not found." });
    res.json(area);
  } catch (err) {
    next(err);
  }
});

// POST /api/areas  (auth required)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { area_name, division, region_type, zip_code } = req.body;
    if (!area_name || !division || !region_type) {
      return res.status(400).json({ error: "area_name, division, and region_type are required." });
    }
    const newArea = await areaRepository.create({ area_name, division, region_type, zip_code });
    res.status(201).json(newArea);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "An area with that name already exists." });
    }
    next(err);
  }
});

// PUT /api/areas/:id  (auth required) - edit any field
router.put("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const updatedArea = await areaRepository.update(req.params.id, req.body);
    if (!updatedArea) return res.status(404).json({ error: "Area not found." });
    res.json(updatedArea);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "An area with that name already exists." });
    }
    next(err);
  }
});

// DELETE /api/areas/:id  (auth required)
router.delete("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const deleted = await areaRepository.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Area not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/areas/:id/report  - calls sp_area_report via AreaRepository
router.get("/:id/report", validateIdParam("id"), async (req, res, next) => {
  try {
    const report = await areaRepository.getAreaReport(req.params.id);
    if (!report) return res.status(404).json({ error: "Area not found." });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

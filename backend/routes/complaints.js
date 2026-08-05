// routes/complaints.js
// -----------------------------------------------------------------------------
// Complaints can be filed by anyone (citizen-facing form, public).
// Updating status / resolution notes requires an authenticated authority user.
// Uses ComplaintRepository for encapsulated data operations.
// -----------------------------------------------------------------------------
const express = require("express");
const { complaintRepository } = require("../repositories");
const { requireAuth } = require("../middleware/auth");
const { complaintLimiter } = require("../middleware/rateLimiter");
const { validateIdParam } = require("../middleware/validator");

const router = express.Router();
const VALID_STATUSES = ["open", "in_review", "resolved", "rejected"];

// GET /api/complaints?area_id=&status=&search=
router.get("/", async (req, res, next) => {
  try {
    const { area_id, status, search } = req.query;
    const complaints = await complaintRepository.findAll({ area_id, status, search });
    res.json(complaints);
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id
router.get("/:id", validateIdParam("id"), async (req, res, next) => {
  try {
    const complaint = await complaintRepository.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    res.json(complaint);
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id/actions - get all authority actions logged for this complaint (1:M relationship)
router.get("/:id/actions", validateIdParam("id"), async (req, res, next) => {
  try {
    const { actionRepository } = require("../repositories");
    const actions = await actionRepository.findByComplaintId(req.params.id);
    res.json(actions);
  } catch (err) {
    next(err);
  }
});

// POST /api/complaints  - citizen files a complaint (public, rate limited)
// body: { citizen_id OR (full_name, phone, area_id) , area_id, description, schedule_id? }
router.post("/", complaintLimiter, async (req, res, next) => {
  try {
    const { citizen_id, full_name, phone, email, area_id, description, schedule_id } = req.body;
    if (!area_id || !description) {
      return res.status(400).json({ error: "area_id and description are required." });
    }

    if (!citizen_id && !full_name) {
      return res.status(400).json({ error: "Provide citizen_id or a full_name to register the citizen." });
    }

    const complaint = await complaintRepository.createWithTransaction({
      citizen_id,
      full_name,
      phone,
      email,
      area_id,
      description,
      schedule_id,
    });

    res.status(201).json(complaint);
  } catch (err) {
    next(err);
  }
});

// PUT /api/complaints/:id  (auth required) - update status / resolution note
router.put("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const { status, resolution_note } = req.body;
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` });
    }

    const updated = await complaintRepository.update(req.params.id, { status, resolution_note });
    if (!updated) return res.status(404).json({ error: "Complaint not found." });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/complaints/:id (auth required)
router.delete("/:id", requireAuth, validateIdParam("id"), async (req, res, next) => {
  try {
    const deleted = await complaintRepository.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Complaint not found." });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

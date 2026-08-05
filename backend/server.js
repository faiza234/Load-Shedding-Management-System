// server.js
// -----------------------------------------------------------------------------
// Entry point. Starts the Express API AND serves the static frontend.
// Integrated with rate-limiting, centralized repository architecture,
// and enhanced error handling.
// -----------------------------------------------------------------------------
const path = require("path");
const express = require("express");
const cors = require("cors");
const { apiLimiter } = require("./middleware/rateLimiter");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const areaRoutes = require("./routes/areas");
const citizenRoutes = require("./routes/citizens");
const complaintRoutes = require("./routes/complaints");
const scheduleRoutes = require("./routes/schedules");
const actionRoutes = require("./routes/actions");
const analyticsRoutes = require("./routes/analytics");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- API Rate Limiter --------------------------------------------------------
app.use("/api", apiLimiter);

// --- API routes ------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/citizens", citizenRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/actions", actionRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// --- Static frontend ---------------------------------------------------------
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

// Fallback: any non-API route serves index.html (simple multi-page app)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// --- Centralized Error handler -----------------------------------------------
app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "Duplicate entry conflict." });
  }
  if (err.code === "ER_NO_REFERENCED_ROW_2" || err.code === "ER_NO_REFERENCED_ROW") {
    return res.status(400).json({ error: "Referenced entity does not exist." });
  }
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`\nLoad Shedding Management System running:`);
  console.log(`  -> http://localhost:${PORT}\n`);
});

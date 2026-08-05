// middleware/auth.js
// -----------------------------------------------------------------------------
// Very small JWT-based auth layer for the Authority (admin/officer) side of
// the system. Citizens filing complaints do NOT need to log in - only staff
// who manage areas, schedules, and complaint resolution do.
// -----------------------------------------------------------------------------
const jwt = require("jsonwebtoken");

// In a real deployment, put this in an environment variable instead.
const JWT_SECRET = process.env.JWT_SECRET || "lsms-dev-secret-change-me";

function signToken(user) {
  return jwt.sign(
    { user_id: user.user_id, user_name: user.user_name, role: user.role },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

// Reads "Authorization: Bearer <token>" and attaches req.user if valid.
function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authorization token." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// Restricts a route to specific roles, e.g. requireRole('admin')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do that." });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET };

// middleware/validator.js
// -----------------------------------------------------------------------------
// Input validation and sanitization middleware to catch malformed payloads,
// invalid numeric IDs, and invalid ENUM inputs before reaching repositories.
// -----------------------------------------------------------------------------

function validateIdParam(paramName = "id") {
  return (req, res, next) => {
    const val = req.params[paramName];
    const num = Number(val);
    if (!val || !Number.isInteger(num) || num <= 0) {
      return res.status(400).json({ error: `Invalid ${paramName} parameter.` });
    }
    next();
  };
}

function sanitizeString(str) {
  if (typeof str !== "string") return str;
  return str.trim();
}

module.exports = {
  validateIdParam,
  sanitizeString,
};

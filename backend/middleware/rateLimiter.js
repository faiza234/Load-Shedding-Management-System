// middleware/rateLimiter.js
// -----------------------------------------------------------------------------
// In-memory sliding window rate limiter middleware for real system protection.
// Prevents brute-force attacks, API abuse, and DDoS attempts.
// -----------------------------------------------------------------------------

function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests, please try again later." } = {}) {
  const requests = new Map();

  // Periodically clean up expired entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, valid);
      }
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown-ip";
    const now = Date.now();

    const userTimestamps = requests.get(ip) || [];
    const windowStart = now - windowMs;
    const validTimestamps = userTimestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= max) {
      res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: message });
    }

    validTimestamps.push(now);
    requests.set(ip, validTimestamps);
    next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: "Too many login attempts. Please try again after 15 minutes.",
});

const complaintLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: "Too many complaints submitted from this IP. Please wait a few minutes.",
});

const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: "API rate limit exceeded. Please slow down.",
});

module.exports = {
  createRateLimiter,
  authLimiter,
  complaintLimiter,
  apiLimiter,
};

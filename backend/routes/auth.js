/**
 * Auth routes — login, register, token refresh
 */
const express = require("express");
const crypto = require("crypto");
const { signToken } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * In dev mode: auto-creates a demo user if email matches.
 * In production: validates against DB (Prisma User model).
 */
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Dev mode: accept any login
  if (process.env.NODE_ENV !== "production") {
    const token = signToken(
      { id: "dev-user", email, role: "admin" },
      process.env.JWT_SECRET || "dev-secret"
    );
    return res.json({
      token,
      user: { id: "dev-user", email, name: email.split("@")[0], role: "admin" },
    });
  }

  // Production: validate credentials
  // TODO: Integrate with Prisma User model
  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  // Hash comparison would go here
  const hashedInput = crypto.createHash("sha256").update(password).digest("hex");
  void hashedInput; // Placeholder for DB lookup

  return res.status(501).json({ error: "Production auth not yet configured. Set up Prisma User model." });
});

/**
 * POST /api/auth/register
 */
router.post("/register", (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  if (process.env.NODE_ENV !== "production") {
    const token = signToken(
      { id: `user-${Date.now()}`, email, role: "user" },
      process.env.JWT_SECRET || "dev-secret"
    );
    return res.json({
      token,
      user: { id: `user-${Date.now()}`, email, name: name || email.split("@")[0], role: "user" },
    });
  }

  return res.status(501).json({ error: "Production registration not yet configured." });
});

/**
 * GET /api/auth/me — returns current user from token
 */
router.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: req.user });
});

module.exports = router;

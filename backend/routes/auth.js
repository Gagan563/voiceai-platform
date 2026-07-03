/**
 * Auth routes — login, register, token refresh
 */
const express = require("express");
const crypto = require("crypto");
const { requireJwtSecret, signToken } = require("../middleware/auth");
const config = require("../config");

const router = express.Router();

function setAuthCookie(res, token) {
  res.cookie("nova_auth", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction(),
    path: "/",
    maxAge: config.JWT_EXPIRY_SECONDS * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie("nova_auth", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction(),
    path: "/",
  });
}

function cleanCredentials(body = {}) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  return { email, password, name };
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * In dev mode: auto-creates a demo user if email matches.
 * In production: validates against DB (Prisma User model).
 */
router.post("/login", (req, res) => {
  const { email, password, name } = cleanCredentials(req.body);
  const secret = requireJwtSecret(res);
  if (!secret) return;

  if (!email) {
    return res.status(400).json({ error: "Email must be a string" });
  }

  // Dev mode: accept any login
  if (!config.isProduction()) {
    const devId = `dev-${crypto.createHash("sha256").update(email).digest("hex").slice(0, 12)}`;
    const token = signToken(
      { id: devId, email, role: "admin" },
      secret
    );
    setAuthCookie(res, token);
    return res.json({
      token,
      user: { id: devId, email, name: name || email.split("@")[0], role: "admin" },
    });
  }

  // Production: validate credentials
  // TODO: Integrate with Prisma User model for full credential validation
  if (!password) {
    return res.status(400).json({ error: "Password must be a string" });
  }

  // Hash comparison placeholder — replace with bcrypt + DB lookup in production
  const hashedInput = crypto.createHash("sha256").update(password).digest("hex");
  void hashedInput;

  return res.status(501).json({ error: "Production auth not yet configured. Set up Prisma User model and password hashing." });
});

/**
 * POST /api/auth/register
 */
router.post("/register", (req, res) => {
  const { email, name, password } = cleanCredentials(req.body);
  const secret = requireJwtSecret(res);
  if (!secret) return;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password must be strings" });
  }

  if (!config.isProduction()) {
    const id = `user-${Date.now()}`;
    const token = signToken(
      { id, email, role: "user" },
      secret
    );
    setAuthCookie(res, token);
    return res.json({
      token,
      user: { id, email, name: name || email.split("@")[0], role: "user" },
    });
  }

  return res.status(501).json({ error: "Production registration not yet configured." });
});

/**
 * POST /api/auth/logout — clears the auth cookie even if the token is missing
 * or expired.
 */
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
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

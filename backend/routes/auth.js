/**
 * Auth routes — login, register, token refresh, logout
 *
 * Dev mode: auto-creates users, no password required.
 * Production: full bcrypt password hashing + Prisma User model.
 */
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { requireJwtSecret, signToken, signRefreshToken, verifyToken, REFRESH_TOKEN_EXPIRY } = require("../middleware/auth");
const config = require("../config");

const router = express.Router();

const BCRYPT_ROUNDS = 12;

// ── Prisma lazy-load ──
// In dev mode with VOICEAI_MEMORY_MODE=local, Prisma may not be available.
// We load it lazily so auth routes don't crash the server on import.

let _prisma = null;

function getPrisma() {
  if (_prisma) return _prisma;
  try {
    const { PrismaClient } = require("@prisma/client");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const { Pool } = require("pg");

    if (!config.DATABASE_URL) return null;

    const pool = new Pool({ connectionString: config.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    _prisma = new PrismaClient({ adapter });
    return _prisma;
  } catch (err) {
    console.warn("[Auth] Prisma not available:", err.message);
    return null;
  }
}

// ── Cookie helpers ──

function setAuthCookie(res, token) {
  const prod = config.isProduction();
  res.cookie("nova_auth", token, {
    httpOnly: true,
    sameSite: prod ? "none" : "lax",
    secure: prod,
    path: "/",
    maxAge: config.JWT_EXPIRY_SECONDS * 1000,
  });
}

function setRefreshCookie(res, token) {
  const prod = config.isProduction();
  res.cookie("nova_refresh", token, {
    httpOnly: true,
    sameSite: prod ? "none" : "lax",
    secure: prod,
    path: "/api/auth", // Only sent to auth endpoints
    maxAge: REFRESH_TOKEN_EXPIRY * 1000,
  });
}

function clearAuthCookie(res) {
  const prod = config.isProduction();
  res.clearCookie("nova_auth", {
    httpOnly: true,
    sameSite: prod ? "none" : "lax",
    secure: prod,
    path: "/",
  });
  res.clearCookie("nova_refresh", {
    httpOnly: true,
    sameSite: prod ? "none" : "lax",
    secure: prod,
    path: "/api/auth",
  });
}

function readCookieValue(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || typeof cookieHeader !== "string") return null;
  const match = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
}

function cleanCredentials(body = {}) {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  return { email, password, name };
}

function issueTokens(res, payload, secret) {
  const token = signToken(payload, secret);
  const refreshToken = signRefreshToken(payload, secret);
  setAuthCookie(res, token);
  setRefreshCookie(res, refreshToken);
  return token;
}

// ── Password validation ──

function validatePasswordStrength(password) {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (password.length > 128) {
    return "Password must be at most 128 characters long";
  }
  return null;
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * In dev mode: auto-creates a demo user if email matches.
 * In production: validates against DB (Prisma User model) with bcrypt.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password, name } = cleanCredentials(req.body);
    const secret = requireJwtSecret(res);
    if (!secret) return;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // ── Dev mode: accept any login ──
    if (!config.isProduction()) {
      const devId = `dev-${crypto.createHash("sha256").update(email).digest("hex").slice(0, 12)}`;
      const payload = { id: devId, email, role: "admin" };
      const token = issueTokens(res, payload, secret);
      return res.json({
        token,
        user: { id: devId, email, name: name || email.split("@")[0], role: "admin" },
      });
    }

    // ── Production: validate against DB ──
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return res.status(503).json({
        error: "Database not available",
        hint: "Set DATABASE_URL in your .env file and run prisma migrate.",
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      // Constant-time fake compare to prevent timing attacks
      await bcrypt.compare(password, "$2a$12$fakehashfakehashfakehashfakehashfakehashfakehas");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const payload = { id: user.id, email: user.email, role: user.role || "user" };
    const token = issueTokens(res, payload, secret);

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name || email.split("@")[0], role: user.role || "user" },
    });
  } catch (error) {
    console.error("[Auth] Login error:", error.message);
    return res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /api/auth/register
 * Body: { email, password, name }
 */
router.post("/register", async (req, res) => {
  try {
    const { email, name, password } = cleanCredentials(req.body);
    const secret = requireJwtSecret(res);
    if (!secret) return;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // ── Dev mode: auto-register ──
    if (!config.isProduction()) {
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      const id = `user-${Date.now()}`;
      const payload = { id, email, role: "user" };
      const token = issueTokens(res, payload, secret);
      return res.json({
        token,
        user: { id, email, name: name || email.split("@")[0], role: "user" },
      });
    }

    // ── Production: create in DB ──
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    const prisma = getPrisma();
    if (!prisma) {
      return res.status(503).json({
        error: "Database not available",
        hint: "Set DATABASE_URL in your .env file and run prisma migrate.",
      });
    }

    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split("@")[0],
        password: hashedPassword,
        role: "user",
      },
    });

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = issueTokens(res, payload, secret);

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("[Auth] Register error:", error.message);
    return res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/auth/refresh — rotate tokens.
 * Reads the refresh token from the nova_refresh cookie, verifies it,
 * and issues a fresh access token + rotated refresh token.
 */
router.post("/refresh", (req, res) => {
  const secret = requireJwtSecret(res);
  if (!secret) return;

  const refreshCookie = readCookieValue(req, "nova_refresh");
  if (!refreshCookie) {
    return res.status(401).json({ error: "No refresh token" });
  }

  try {
    const payload = verifyToken(refreshCookie, secret);
    // Strip iat/exp from the old payload before re-signing.
    const { iat, exp, ...userPayload } = payload;
    const token = issueTokens(res, userPayload, secret);
    res.json({ token, user: userPayload });
  } catch (err) {
    clearAuthCookie(res);
    return res.status(401).json({ error: "Refresh token invalid or expired" });
  }
});

/**
 * POST /api/auth/logout — clears both auth and refresh cookies even if
 * the token is missing or expired.
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

/**
 * DELETE /api/auth/session — hard-clear the auth cookie.
 * Public route (no auth required) so the frontend can guarantee the cookie
 * is gone even during "delete all data" flows when the token is already
 * invalid or the user record is removed.
 */
router.delete("/session", (req, res) => {
  clearAuthCookie(res);
  res.json({ cleared: true });
});

/**
 * POST /api/auth/change-password — update user password
 * Body: { currentPassword, newPassword }
 */
router.post("/change-password", async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required" });
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    return res.status(400).json({ error: strengthError });
  }

  if (!config.isProduction()) {
    return res.json({ success: true, message: "Password updated (dev mode)" });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return res.status(503).json({ error: "Database not available" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.password) {
      return res.status(404).json({ error: "User not found" });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("[Auth] Change password error:", error.message);
    res.status(500).json({ error: "Failed to update password" });
  }
});

module.exports = router;

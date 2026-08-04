const crypto = require("crypto");
const config = require("../config");

/**
 * JWT-like auth middleware.
 * Uses HMAC-SHA256 to sign/verify tokens without external dependencies.
 *
 * Token format: base64url(header).base64url(payload).base64url(signature)
 */

const b64url = (buf) =>
  (Buffer.isBuffer(buf) ? buf : Buffer.from(JSON.stringify(buf)))
    .toString("base64url");

const decode64 = (str) => JSON.parse(Buffer.from(str, "base64url").toString());

function signToken(payload, secret, expiresInSeconds = config.JWT_EXPIRY_SECONDS) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };

  const unsigned = `${b64url(header)}.${b64url(body)}`;
  const sig = crypto.createHmac("sha256", secret).update(unsigned).digest("base64url");

  return `${unsigned}.${sig}`;
}

function verifyToken(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");

  const [headerB64, payloadB64, sigB64] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expected))) {
    throw new Error("Invalid signature");
  }

  const payload = decode64(payloadB64);
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === config.JWT_SECRET_PLACEHOLDER) {
    return null;
  }
  return secret;
}

function requireJwtSecret(res) {
  const secret = getJwtSecret();
  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET not configured" });
    return null;
  }
  return secret;
}

function errorMessage(error, fallback = "Unexpected error") {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Express middleware — checks Authorization: Bearer <token>
 * Skips auth for health, login, and public routes.
 */
function readCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader || typeof cookieHeader !== "string") return null;

  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!match) return null;

  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
}

function getRequestToken(req) {
  // Security: never accept full JWTs from query parameters.
  // Log a warning so operators notice misconfigured clients or proxies.
  if (req.query?.token || req.query?.access_token) {
    console.warn(
      `[Auth] Rejected token from query parameter on ${req.method} ${req.path}. ` +
      "Tokens must be sent via Authorization header or httpOnly cookie."
    );
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const cookieToken = readCookie(req, "nova_auth");
  if (cookieToken) return cookieToken;

  return null;
}

function authMiddleware(req, res, next) {
  // Public routes that don't need auth
  const publicPaths = ["/health", "/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/session", "/api/auth/refresh"];
  if (publicPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const secret = requireJwtSecret(res);
  if (!secret) return;

  const token = getRequestToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    req.user = verifyToken(token, secret);
    next();
  } catch (err) {
    // Return a uniform message — never leak internal token details to clients.
    console.warn(`[Auth] Token verification failed on ${req.path}: ${errorMessage(err)}`);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Refresh tokens are longer-lived (7 days) and stored in a separate cookie.
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

function signRefreshToken(payload, secret) {
  return signToken(payload, secret, REFRESH_TOKEN_EXPIRY);
}

module.exports = {
  signToken,
  signRefreshToken,
  verifyToken,
  authMiddleware,
  getJwtSecret,
  requireJwtSecret,
  REFRESH_TOKEN_EXPIRY,
};

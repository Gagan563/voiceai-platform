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
function authMiddleware(req, res, next) {
  // Public routes that don't need auth
  const publicPaths = ["/health", "/api/auth/login", "/api/auth/register"];
  if (publicPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const secret = requireJwtSecret(res);
  if (!secret) return;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  try {
    const token = authHeader.slice(7);
    req.user = verifyToken(token, secret);
    next();
  } catch (err) {
    return res.status(401).json({ error: `Auth failed: ${errorMessage(err)}` });
  }
}

module.exports = { signToken, verifyToken, authMiddleware, getJwtSecret, requireJwtSecret };

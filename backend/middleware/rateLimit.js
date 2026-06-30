// ============================================
// VoiceAI Platform — Rate Limiting Middleware
// ============================================
//
// Configurable rate limiters for different endpoint tiers.
// Uses express-rate-limit which is already in package.json.

const rateLimit = require("express-rate-limit");

/**
 * AI endpoints — expensive (costs real API credits).
 * 30 requests per minute per IP.
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many AI requests. Please wait a moment before trying again.",
    hint: "This limit protects your API credits. Try again in a minute.",
    retryAfterMs: 60000,
  },
});

/**
 * Agent endpoints — very expensive (multi-turn AI loops).
 * 10 requests per minute per IP.
 */
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many agent requests. The agent runs multi-step AI loops — please wait.",
    hint: "Each agent run can use multiple AI calls. Try again in a minute.",
    retryAfterMs: 60000,
  },
});

/**
 * Auth endpoints — brute-force protection.
 * 10 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again later.",
    retryAfterMs: 15 * 60 * 1000,
  },
});

/**
 * General API — generous limit for normal endpoints.
 * 120 requests per minute per IP.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please slow down.",
    retryAfterMs: 60000,
  },
});

module.exports = { aiLimiter, agentLimiter, authLimiter, generalLimiter };

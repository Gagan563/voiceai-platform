// ============================================
// VoiceAI Platform — Rate Limiting Middleware
// ============================================
//
// Configurable rate limiters for different endpoint tiers.
// Uses express-rate-limit which is already in package.json.

const rateLimit = require("express-rate-limit");
const config = require("../config");

/**
 * AI endpoints — expensive (costs real API credits).
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_AI_MAX,
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
 */
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_AGENT_MAX,
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
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again later.",
    retryAfterMs: 15 * 60 * 1000,
  },
});

/**
 * General API — generous limit for normal endpoints.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.RATE_LIMIT_GENERAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please slow down.",
    retryAfterMs: 60000,
  },
});

module.exports = { aiLimiter, agentLimiter, authLimiter, generalLimiter };

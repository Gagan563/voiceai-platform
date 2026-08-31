// ============================================
// NOVA VoiceAI Platform — Structured Logger
// ============================================

const config = require("../config");

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "jwt",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "gemini_api_key",
  "groq_api_key",
  "anthropic_api_key",
  "openai_api_key",
  "elevenlabs_api_key",
];

function sanitize(obj, depth = 0) {
  if (depth > 4) return "[Max Depth]";
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitize(item, depth + 1));
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitize(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const currentLevel = (process.env.LOG_LEVEL || (config.isProduction() ? "info" : "debug")).toLowerCase();
const currentLevelWeight = LOG_LEVELS[currentLevel] || LOG_LEVELS.info;

function shouldLog(level) {
  return (LOG_LEVELS[level] || 20) >= currentLevelWeight;
}

function formatLog(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const safeContext = sanitize(context);

  if (config.isProduction()) {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...safeContext,
    });
  }

  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const contextStr = Object.keys(safeContext).length > 0 ? " " + JSON.stringify(safeContext) : "";
  return `${prefix} ${message}${contextStr}`;
}

const logger = {
  debug(message, context = {}) {
    if (!shouldLog("debug")) return;
    console.debug(formatLog("debug", message, context));
  },

  info(message, context = {}) {
    if (!shouldLog("info")) return;
    console.info(formatLog("info", message, context));
  },

  warn(message, context = {}) {
    if (!shouldLog("warn")) return;
    console.warn(formatLog("warn", message, context));
  },

  error(message, context = {}) {
    if (!shouldLog("error")) return;
    console.error(formatLog("error", message, context));
  },

  child(defaultContext = {}) {
    return {
      debug: (msg, ctx) => logger.debug(msg, { ...defaultContext, ...ctx }),
      info: (msg, ctx) => logger.info(msg, { ...defaultContext, ...ctx }),
      warn: (msg, ctx) => logger.warn(msg, { ...defaultContext, ...ctx }),
      error: (msg, ctx) => logger.error(msg, { ...defaultContext, ...ctx }),
    };
  },
};

module.exports = logger;

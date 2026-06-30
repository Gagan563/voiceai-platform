// ============================================
// VoiceAI Platform — Structured Logger
// ============================================
//
// Drop-in replacement for console.log with structured JSON output,
// log levels, timestamps, and context tagging.
//
// Usage:
//   const log = require("./utils/logger");
//   log.info("Server started", { port: 3001 });
//   log.error("AI call failed", { provider: "gemini", error: err.message });

const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase();
const IS_JSON = process.env.LOG_FORMAT === "json";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function formatMessage(level, tag, message, data) {
  const timestamp = new Date().toISOString();

  if (IS_JSON) {
    return JSON.stringify({
      timestamp,
      level,
      tag,
      message,
      ...(data && Object.keys(data).length > 0 ? { data } : {}),
    });
  }

  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const tagStr = tag ? ` [${tag}]` : "";
  const dataStr = data && Object.keys(data).length > 0
    ? ` ${JSON.stringify(data)}`
    : "";

  return `${prefix}${tagStr} ${message}${dataStr}`;
}

function shouldLog(level) {
  return (LEVELS[level] ?? LEVELS.info) >= currentLevel;
}

/**
 * Create a logger with a fixed tag (e.g., "Agent", "Memory", "AI").
 *
 *   const log = createLogger("Agent");
 *   log.info("Starting", { input: "build a calculator" });
 */
function createLogger(tag = "") {
  return {
    debug: (message, data) => {
      if (shouldLog("debug")) console.debug(formatMessage("debug", tag, message, data));
    },
    info: (message, data) => {
      if (shouldLog("info")) console.log(formatMessage("info", tag, message, data));
    },
    warn: (message, data) => {
      if (shouldLog("warn")) console.warn(formatMessage("warn", tag, message, data));
    },
    error: (message, data) => {
      if (shouldLog("error")) console.error(formatMessage("error", tag, message, data));
    },
  };
}

// Default logger (no tag)
const defaultLogger = createLogger();

module.exports = {
  ...defaultLogger,
  createLogger,
};

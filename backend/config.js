// ============================================
// NOVA VoiceAI Platform — Centralized Configuration
// ============================================
//
// All environment variables and defaults are read here once.
// Import this module instead of reading process.env inline.

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

// ── Helpers ──

function envList(key, fallback = []) {
  const raw = process.env[key];
  if (!raw) return fallback;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function envInt(key, fallback) {
  const raw = process.env[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(key, fallback = false) {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

// ── Server ──

const PORT = envInt("PORT", 3001);
const NODE_ENV = process.env.NODE_ENV || "development";
const APP_VERSION = process.env.APP_VERSION || "2.0.0";
const APP_NAME = "nova-voiceai";

// ── CORS ──

const CORS_ORIGINS = envList("CORS_ORIGIN", [
  "http://localhost:5173",
  "http://localhost:3000",
]);

// ── Socket.IO ──

const SOCKET_PATH = process.env.SOCKET_PATH || "/socket.io";

// ── JWT ──

const JWT_SECRET_PLACEHOLDER = "change-this-to-a-random-64-char-string-in-production";
const JWT_SECRET = process.env.JWT_SECRET || null;
const JWT_EXPIRY_SECONDS = envInt("JWT_EXPIRY_SECONDS", 86400);

// ── User ──

const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "default-user";

// ── AI Router ──

const AI_ROUTER_MODE = process.env.AI_ROUTER_MODE || "hybrid";
const AI_CIRCUIT_FAILURE_LIMIT = envInt("AI_CIRCUIT_FAILURE_LIMIT", 3);
const AI_CIRCUIT_RESET_MS = envInt("AI_CIRCUIT_RESET_MS", 60_000);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_TIMEOUT_MS = envInt("GROQ_TIMEOUT_MS", 30_000);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const ANTHROPIC_API_VERSION = process.env.ANTHROPIC_API_VERSION || "2023-06-01";

// ── OpenAI (Whisper + Embeddings) ──

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_PLACEHOLDER_KEYS = ["sk-xxxxx-your-openai-key-here", "your-openai-api-key-here"];
const OPENAI_WHISPER_MODEL = process.env.OPENAI_WHISPER_MODEL || "gpt-4o-mini-transcribe";
const OPENAI_WHISPER_LANGUAGE = process.env.OPENAI_WHISPER_LANGUAGE || "en";
const ALLOW_STUB_TRANSCRIPTION = envBool("ALLOW_STUB_TRANSCRIPTION", false);
const DEMO_TRANSCRIPT = process.env.DEMO_TRANSCRIPT ||
  "Schedule a meeting with Sarah next Tuesday at 3pm about the Q4 budget";

// ── ElevenLabs TTS ──

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const ELEVENLABS_PLACEHOLDER_KEYS = ["your-elevenlabs-api-key-here"];
const ELEVENLABS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_monolingual_v1";

// ── Database ──

const DATABASE_URL = process.env.DATABASE_URL ||
  "postgresql://voiceai:voiceai_secret@localhost:5432/voiceai_db";
const MEMORY_MODE = process.env.VOICEAI_MEMORY_MODE || null;

// ── MCP Connectors ──

const CONNECTOR_DEMO_MODE = envBool("CONNECTOR_DEMO_MODE", true);

// ── Safety & Accessibility ──

const CONTENT_MODERATION_ENABLED = envBool("CONTENT_MODERATION_ENABLED", true);
const PARENTAL_CONTROLS_ENABLED = envBool("PARENTAL_CONTROLS_ENABLED", false);
const PARENTAL_CONTROLS_AGE_GROUP = process.env.PARENTAL_CONTROLS_AGE_GROUP || "adult";
const VAD_SILENCE_TIMEOUT_MS = envInt("VAD_SILENCE_TIMEOUT_MS", 2000);

// ── File size limits (bytes) ──

const FILE_SIZE_LIMITS = {
  audio: envInt("MAX_AUDIO_SIZE", 25 * 1024 * 1024),
  image: envInt("MAX_IMAGE_SIZE", 12 * 1024 * 1024),
  agentFile: envInt("MAX_AGENT_FILE_SIZE", 50 * 1024 * 1024),
};

// ── AI token defaults ──

const DEFAULT_MAX_TOKENS = {
  chat: 4096,
  multiTurn: 8192,
  stream: 2048,
  vision: 1200,
  review: 1200,
};

// ── Validation helpers ──

function isPlaceholderKey(key, placeholders) {
  if (!key || key.length < 10) return true;
  return placeholders.some((p) => key === p);
}

function isOpenAIConfigured() {
  return !isPlaceholderKey(OPENAI_API_KEY, OPENAI_PLACEHOLDER_KEYS);
}

function isElevenLabsConfigured() {
  return !isPlaceholderKey(ELEVENLABS_API_KEY, ELEVENLABS_PLACEHOLDER_KEYS);
}

function isJwtConfigured() {
  return JWT_SECRET && JWT_SECRET !== JWT_SECRET_PLACEHOLDER;
}

function isProduction() {
  return NODE_ENV === "production";
}

module.exports = {
  // Server
  PORT,
  NODE_ENV,
  APP_VERSION,
  APP_NAME,

  // CORS
  CORS_ORIGINS,

  // Socket.IO
  SOCKET_PATH,

  // JWT
  JWT_SECRET,
  JWT_SECRET_PLACEHOLDER,
  JWT_EXPIRY_SECONDS,

  // User
  DEFAULT_USER_ID,

  // AI Router
  AI_ROUTER_MODE,
  AI_CIRCUIT_FAILURE_LIMIT,
  AI_CIRCUIT_RESET_MS,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GROQ_API_KEY,
  GROQ_MODEL,
  GROQ_BASE_URL,
  GROQ_TIMEOUT_MS,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  ANTHROPIC_API_VERSION,

  // OpenAI
  OPENAI_API_KEY,
  OPENAI_WHISPER_MODEL,
  OPENAI_WHISPER_LANGUAGE,
  ALLOW_STUB_TRANSCRIPTION,
  DEMO_TRANSCRIPT,

  // ElevenLabs
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  ELEVENLABS_MODEL,

  // Database
  DATABASE_URL,
  MEMORY_MODE,

  // MCP
  CONNECTOR_DEMO_MODE,

  // Safety & Accessibility
  CONTENT_MODERATION_ENABLED,
  PARENTAL_CONTROLS_ENABLED,
  PARENTAL_CONTROLS_AGE_GROUP,
  VAD_SILENCE_TIMEOUT_MS,

  // Limits
  FILE_SIZE_LIMITS,
  DEFAULT_MAX_TOKENS,

  // Helpers
  isOpenAIConfigured,
  isElevenLabsConfigured,
  isJwtConfigured,
  isProduction,
};

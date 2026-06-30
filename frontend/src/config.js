// ============================================
// NOVA VoiceAI Platform — Frontend Configuration
// ============================================
//
// All Vite env vars and UI defaults are read here once.
// Import this module instead of reading import.meta.env inline.

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "/api";
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";

export const APP_NAME = "NOVA";
export const APP_VERSION = "v2";

// ── Store ──

export const STORE_KEY = "voxmind-store";

// ── AI Models ──

export const DEFAULT_MODEL = "gemini-2.5-flash";

export const MODEL_OPTIONS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4", provider: "anthropic" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude Sonnet 3.5", provider: "anthropic" },
];

// ── Finance defaults ──

export const DEFAULT_PORTFOLIO_SYMBOLS = "AAPL,GOOGL,MSFT";

// ── Demo ──

export const DEMO_EMAIL = "demo@nova.local";
export const DEMO_NAME = "Demo Owner";

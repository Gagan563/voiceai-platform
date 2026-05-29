import axios from "axios";

/**
 * Axios client configured to talk to the VoiceAI backend.
 * Uses the Vite proxy in development (/api → http://localhost:3001).
 */
const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Response Interceptor ──
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";

    const hint = error.response?.data?.hint || null;

    console.error("[API Error]", {
      status: error.response?.status,
      message,
      hint,
      url: error.config?.url,
    });

    return Promise.reject({
      message,
      hint,
      status: error.response?.status,
    });
  }
);

// ── API Methods ──

/**
 * POST /intent — Extract intent from natural language text
 */
export async function extractIntent(text) {
  return client.post("/intent", { text });
}

/**
 * POST /plan — Generate execution plan from intent
 */
export async function generatePlan(intent) {
  return client.post("/plan", { intent });
}

/**
 * POST /execute — Execute an approved plan
 */
export async function executePlan(plan) {
  return client.post("/execute", { plan });
}

/**
 * POST /transcribe — Transcribe audio to text (stub)
 */
export async function transcribeAudio(audioFile) {
  const formData = new FormData();
  formData.append("audio", audioFile);
  return client.post("/transcribe", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/**
 * GET /health — Health check
 */
export async function healthCheck() {
  return client.get("/health");
}

export default client;

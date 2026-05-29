import axios from "axios";

/**
 * VoxMind API client.
 *
 * A real Axios instance is configured so the app is backend-ready. While the
 * backend is not connected, calls are served by local mocks with realistic
 * delays. Set VITE_USE_MOCK_API=false once the backend is live.
 */
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "/api";
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== "false";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("voxmind-store");
    if (raw) {
      const key = JSON.parse(raw)?.state?.settings?.apiKeys?.anthropic;
      if (key) config.headers["x-api-key"] = key;
    }
  } catch {
    // Persisted settings are optional.
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Network error. Please check your connection.";
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

const delay = (min = 900, max = 1700) =>
  new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

const newId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const detectActionType = (text) => {
  const value = text.toLowerCase();

  if (/(schedule|meeting|calendar|appointment|book|invite|sync)/.test(value)) {
    return "schedule";
  }

  if (/(remind|reminder|remember to|don't forget|dont forget|nudge)/.test(value)) {
    return "remind";
  }

  if (/(search|find|look up|google|news|research)/.test(value)) {
    return "search";
  }

  if (/(email|send|message|text|mail|reply|draft)/.test(value)) {
    return "message";
  }

  return "general";
};

const planTemplates = {
  schedule: (goal) => [
    {
      description: "Check your calendar for conflicts",
      action_type: "schedule",
      service: "calendar",
      action: "check_availability",
    },
    {
      description: `Create a calendar event for "${goal}"`,
      action_type: "schedule",
      service: "calendar",
      action: "create_event",
    },
    {
      description: "Send invites to the relevant people",
      action_type: "message",
      service: "email",
      action: "send_invites",
    },
  ],
  remind: (goal) => [
    {
      description: `Create a reminder titled "${goal}"`,
      action_type: "remind",
      service: "notification",
      action: "create_reminder",
    },
    {
      description: "Schedule a notification at the right time",
      action_type: "remind",
      service: "notification",
      action: "schedule_notification",
    },
  ],
  search: (goal) => [
    {
      description: `Search the web for "${goal}"`,
      action_type: "search",
      service: "web",
      action: "web_search",
    },
    {
      description: "Summarise the most relevant results for you",
      action_type: "search",
      service: "ai",
      action: "summarize_results",
    },
  ],
  message: (goal) => [
    {
      description: `Draft a message about "${goal}"`,
      action_type: "message",
      service: "ai",
      action: "draft_message",
    },
    {
      description: "Review the draft before sending",
      action_type: "general",
      service: "ai",
      action: "review_draft",
      requires_input: true,
    },
    {
      description: "Send it to the chosen recipients",
      action_type: "message",
      service: "email",
      action: "send_message",
    },
  ],
  general: (goal) => [
    {
      description: `Understand exactly what you mean by "${goal}"`,
      action_type: "general",
      service: "ai",
      action: "clarify_goal",
    },
    {
      description: "Carry out the task and report back",
      action_type: "general",
      service: "ai",
      action: "complete_task",
    },
  ],
};

const toPlanStep = (step, index) => ({
  id: step.id || newId(),
  step: index + 1,
  action: step.action || step.action_type || "general",
  action_type: step.action_type || step.action || "general",
  description: step.description,
  service: step.service || "ai",
  requires_input: Boolean(step.requires_input),
  estimated_duration_seconds: step.estimated_duration_seconds || 2 + index,
  fallback: step.fallback || "Ask for confirmation and retry this step",
});

export async function healthCheck() {
  if (USE_MOCK) {
    await delay(150, 300);
    return { status: "ok", service: "voxmind-mock" };
  }

  return apiClient.get("/health");
}

export async function extractIntent(text) {
  if (USE_MOCK) {
    await delay(500, 900);
    const action_type = detectActionType(text);
    const goal = text.trim().replace(/[.?!]+$/, "");

    return {
      intent: {
        goal,
        action_type,
        entities: { raw: text },
        constraints: [],
        missing_info: [],
        confidence: 0.86 + Math.random() * 0.12,
      },
    };
  }

  return apiClient.post("/intent", { text });
}

export async function generatePlan(intent) {
  if (USE_MOCK) {
    await delay(700, 1300);
    const build = planTemplates[intent.action_type] || planTemplates.general;
    const plan = build(intent.goal).map(toPlanStep);

    return { plan, steps: plan };
  }

  return apiClient.post("/plan", { intent });
}

export async function executePlan(plan) {
  if (USE_MOCK) {
    await delay(900, 1600);

    return {
      status: "ok",
      message: "Done! I've carried out your plan.",
      execution_id: `exec_${newId()}`,
      steps_received: plan.length,
    };
  }

  return apiClient.post("/execute", { plan, steps: plan });
}

export async function transcribeAudio(audioBlob) {
  if (USE_MOCK) {
    await delay(800, 1400);
    return { transcript: "(transcribed audio)" };
  }

  const form = new FormData();
  form.append("audio", audioBlob);

  return apiClient.post("/transcribe", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function getMemories() {
  if (USE_MOCK) {
    await delay(300, 600);
    return { memories: [] };
  }

  return apiClient.get("/memories");
}

export async function deleteMemory(id) {
  if (USE_MOCK) {
    await delay(200, 400);
    return { success: true };
  }

  return apiClient.delete(`/memories/${id}`);
}

export async function testConnection(key) {
  await delay(700, 1300);

  if (!key || key.trim().length < 12) {
    throw new Error("Invalid key");
  }

  return { ok: true };
}

export default apiClient;

import axios from "axios";

/**
 * VoxMind API client.
 *
 * A real Axios instance is configured so the app talks to the local backend by
 * default. Set VITE_USE_MOCK_API=true when you want the standalone demo mode.
 */
const BASE_URL = import.meta.env.VITE_BACKEND_URL || "/api";
const USE_MOCK = import.meta.env.VITE_USE_MOCK_API === "true";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem("voxmind-store");
    if (raw) {
      const settings = JSON.parse(raw)?.state?.settings;
      const key = settings?.apiKeys?.anthropic;
      const model = settings?.selectedModel;
      if (key) config.headers["x-api-key"] = key;
      if (model) config.headers["x-model"] = model;
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

export const getAgentOutputUrl = (filename) => {
  if (!filename) return null;
  const clean = String(filename).replace(/^\/+/, "");
  const base = BASE_URL === "/api" ? "/api" : BASE_URL.replace(/\/$/, "");
  return `${base}/agent/output/${encodeURI(clean)}`;
};

const getSelectedModel = () => {
  try {
    const raw = localStorage.getItem("voxmind-store");
    return (
      JSON.parse(raw)?.state?.settings?.selectedModel ||
      "claude-sonnet-4-20250514"
    );
  } catch {
    return "claude-sonnet-4-20250514";
  }
};

const detectActionType = (text) => {
  const value = text.toLowerCase();

  if (/(build|create|generate|make|develop|platform|app|website|dashboard|requirements|prd|spec)/.test(value)) {
    return "create";
  }

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
  create: (goal) => [
    {
      description: `Read the requirement and define the product goal for "${goal}"`,
      action_type: "create",
      service: "ai",
      action: "analyze_requirements",
    },
    {
      description: "Choose the core workflow, data objects, and automation boundaries",
      action_type: "create",
      service: "ai",
      action: "design_system_plan",
    },
    {
      description: "Map the coding-agent workspace: codebase brain, terminal runner, tests, review, browser preview, memory, connectors, and checkpoints",
      action_type: "create",
      service: "ai",
      action: "map_dev_agent_suite",
    },
    {
      description: "Generate a clickable product preview with intake, planner, executor, developer tools, and result views",
      action_type: "create",
      service: "filesystem",
      action: "generate_preview",
    },
    {
      description: "Run validation checks for missing requirements, risky actions, and user approval points",
      action_type: "automate",
      service: "ai",
      action: "validate_workflow",
    },
    {
      description: "Create permission gates for terminal commands, filesystem edits, browser control, GitHub actions, and deployments",
      action_type: "automate",
      service: "ai",
      action: "design_permission_gates",
    },
    {
      description: "Prepare the next build task list for backend executors, integrations, and deployment",
      action_type: "create",
      service: "ai",
      action: "prepare_build_backlog",
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
  const model = getSelectedModel();

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
      metadata: { model },
    };
  }

  return apiClient.post("/intent", { text, model });
}

export async function generatePlan(intent) {
  const model = getSelectedModel();

  if (USE_MOCK) {
    await delay(700, 1300);
    const build = planTemplates[intent.action_type] || planTemplates.general;
    const plan = build(intent.goal).map(toPlanStep);

    return { plan, steps: plan, metadata: { model } };
  }

  return apiClient.post("/plan", { intent, model });
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

export async function analyzeContextImage(file, prompt, type = "image") {
  if (USE_MOCK) {
    await delay(700, 1200);
    return {
      success: true,
      type,
      filename: file?.name || "context.png",
      analysis: "Mock image context captured. Describe what you want me to do with it.",
    };
  }

  const form = new FormData();
  form.append("image", file);
  form.append("prompt", prompt || "Summarize this image or screen for my next voice command.");
  form.append("type", type);

  return apiClient.post("/context/image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function getRoutines() {
  if (USE_MOCK) {
    await delay(200, 400);
    return { success: true, routines: [] };
  }
  return apiClient.get("/routines");
}

export async function createRoutine(routine) {
  if (USE_MOCK) {
    await delay(300, 600);
    return {
      success: true,
      routine: {
        id: newId(),
        enabled: true,
        schedule: "daily",
        time: "09:00",
        ...routine,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        runs: [],
      },
    };
  }
  return apiClient.post("/routines", routine);
}

export async function updateRoutine(id, updates) {
  if (USE_MOCK) {
    await delay(200, 400);
    return { success: true, routine: { id, ...updates } };
  }
  return apiClient.patch(`/routines/${id}`, updates);
}

export async function deleteRoutine(id) {
  if (USE_MOCK) {
    await delay(200, 400);
    return { success: true, deleted: 1 };
  }
  return apiClient.delete(`/routines/${id}`);
}

export async function runRoutine(id) {
  if (USE_MOCK) {
    await delay(700, 1200);
    return { success: true, result: { status: "ok", review: { summary: "Mock routine ran." } } };
  }
  return apiClient.post(`/routines/${id}/run`, {});
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

export async function getMemories(userId = "default-user") {
  if (USE_MOCK) {
    await delay(300, 600);
    return { memories: [] };
  }

  return apiClient.get(`/memories/${userId}`);
}

export async function deleteMemory(userId = "default-user", memoryId) {
  if (USE_MOCK) {
    await delay(200, 400);
    return { success: true };
  }

  return apiClient.delete(`/memories/${userId}/${memoryId}`);
}

export async function clearAllMemories(userId = "default-user") {
  if (USE_MOCK) {
    await delay(300, 500);
    return { success: true, deleted: 0 };
  }

  return apiClient.delete(`/memories/${userId}/all`);
}

export async function testConnection(key) {
  await delay(700, 1300);

  if (!key || key.trim().length < 12) {
    throw new Error("Invalid key");
  }

  return { ok: true };
}

// ── Module Integration APIs ──

export async function moduleSearch(query) {
  if (USE_MOCK) {
    await delay(400, 800);
    return {
      success: true,
      engine: "demo",
      results: [
        { title: `Result for "${query}"`, url: "#", snippet: "Demo search result." },
      ],
    };
  }
  return apiClient.get(`/modules/search?q=${encodeURIComponent(query)}`);
}

export async function moduleFinanceQuote(symbol) {
  if (USE_MOCK) {
    await delay(300, 600);
    return { success: true, engine: "demo", symbol, price: "175.24", change: "+2.31", changePercent: "+1.34%" };
  }
  return apiClient.get(`/modules/finance/quote?symbol=${encodeURIComponent(symbol)}`);
}

export async function moduleFinancePortfolio(symbols = "AAPL,GOOGL,MSFT") {
  if (USE_MOCK) {
    await delay(400, 700);
    return {
      success: true,
      engine: "demo",
      portfolio: symbols.split(",").map((s) => ({
        symbol: s.trim(),
        price: (100 + Math.random() * 200).toFixed(2),
        change: (Math.random() * 10 - 5).toFixed(2),
        changePercent: (Math.random() * 6 - 3).toFixed(2) + "%",
      })),
    };
  }
  return apiClient.get(`/modules/finance/portfolio?symbols=${encodeURIComponent(symbols)}`);
}

export async function moduleTranslate(text, target, source) {
  if (USE_MOCK) {
    await delay(500, 900);
    return { success: true, engine: "demo", translated: `[${target}] ${text}`, source: source || "auto", target };
  }
  return apiClient.post("/modules/translate", { text, target, source });
}

export async function moduleMediaNowPlaying() {
  if (USE_MOCK) {
    await delay(300, 500);
    return { success: false, status: "not_configured", error: "Spotify not configured" };
  }
  return apiClient.get("/modules/media/now-playing");
}

export async function moduleMediaPlay(query) {
  return apiClient.post("/modules/media/play", { query });
}

export async function moduleMediaPause() {
  return apiClient.post("/modules/media/pause");
}

export async function mcpConnectors() {
  if (USE_MOCK) {
    await delay(200, 400);
    return {
      success: true,
      connectors: [
        { id: "calendar", name: "Calendar", configured: false, actions: ["list_events", "create_event"] },
        { id: "email", name: "Gmail", configured: false, actions: ["send_email", "read_inbox"] },
        { id: "spotify", name: "Spotify", configured: false, actions: ["play", "pause", "skip"] },
        { id: "home_assistant", name: "Home Assistant", configured: false, actions: ["get_devices", "control_device"] },
        { id: "web_search", name: "Web Search", configured: true, actions: ["search"] },
      ],
    };
  }
  return apiClient.get("/mcp/connectors");
}

export async function mcpCall(connectorId, action, params = {}) {
  if (USE_MOCK) {
    await delay(500, 1000);
    return { success: false, status: "not_configured", error: `${connectorId} not configured in demo mode.` };
  }
  return apiClient.post("/mcp/call", { connectorId, action, params });
}

export default apiClient;

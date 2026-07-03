// ============================================
// VoiceAI Platform — Chat Routes
// ============================================
//
// Extracted from server.js: /intent, /plan, /execute, /chat/direct, /chat/stream

const express = require("express");
const { INTENT_EXTRACTION_PROMPT, PLAN_GENERATION_PROMPT } = require("../prompts");
const { recallMemory, extractFacts, saveMemory } = require("../services/memory");
const ai = require("../services/ai");
const { runAgent } = require("../services/agent");
const { executeTool } = require("../services/tools");
const { emitToUser } = require("../socket");
const {
  createReminderFromStep,
} = require("../services/reminders");
const config = require("../config");

const router = express.Router();

function errorMessage(error, fallback = "Unexpected error") {
  return error instanceof Error ? error.message : fallback;
}

function currentUserId(req) {
  return req.user?.id;
}

// ── Helpers ──

function inferModuleFromText(text = "") {
  const value = text.toLowerCase();
  if (isAppBuildRequest(value)) return "write";
  const rules = [
    ["health", /(health|symptom|medicine|medication|water|sleep|mood|exercise|bmi|calorie|doctor)/],
    ["finance", /(finance|expense|income|budget|spending|bill|currency|money|invoice)/],
    ["learn", /(learn|lesson|quiz|flashcard|teach|study|explain|homework)/],
    ["home", /(home assistant|smart home|light|thermostat|room|device|scene)/],
    ["travel", /(travel|trip|itinerary|flight|hotel|visa|packing|destination|weather)/],
    ["media", /(music|movie|tv|book|podcast|youtube|spotify|news|entertainment)/],
    ["translate", /(translate|translation|language|phrase|pronunciation)/],
    ["business", /(business|meeting summary|crm|contact|report|csv|data analysis|proposal)/],
    ["write", /(write|draft|email|essay|blog|post|cover letter|content|generate code)/],
    ["search", /(search|research|find|look up|source|latest)/],
    ["task", /(task|schedule|meeting|remind|reminder|calendar|checklist)/],
  ];

  return rules.find(([, pattern]) => pattern.test(value))?.[0] || "chat";
}

function inferActionType(text = "") {
  const value = text.toLowerCase();
  if (/(schedule|meeting|calendar|book)/.test(value)) return "schedule";
  if (/(remind|reminder|notify)/.test(value)) return "remind";
  if (/(search|research|find|look up|latest)/.test(value)) return "search";
  if (/(translate|language)/.test(value)) return "translate";
  if (/(turn on|turn off|control|thermostat|light)/.test(value)) return "control";
  if (/(write|draft|create|generate|make|build)/.test(value)) return "create";
  return "answer";
}

function isAppBuildRequest(text = "") {
  const value = String(text || "").toLowerCase();
  return (
    /\b(build|create|make|generate|develop)\b/.test(value) &&
    /\b(app|application|website|web app|dashboard|preview|prototype|page|site|game)\b/.test(value)
  );
}

function confidenceNumber(value, fallback = 0.72) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function stringValue(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function buildClarifyingQuestion(intent = {}) {
  const missing = Array.isArray(intent.missing_info) ? intent.missing_info.filter(Boolean) : [];
  if (missing.length > 0) {
    return `I can do that. What should I use for ${missing[0]}?`;
  }
  const goal = intent.goal || "that request";
  return `I want to make sure I understood ${goal}. What should the final result look like?`;
}

function enrichIntent(intent = {}, sourceText = "") {
  const confidence = confidenceNumber(intent.confidence);
  const missingInfo = Array.isArray(intent.missing_info) ? intent.missing_info : [];
  const needsClarification = confidence < 0.7;

  return {
    ...intent,
    goal: intent.goal || sourceText.trim() || "Help with a VoxMind request",
    missing_info: missingInfo,
    confidence,
    clarification: needsClarification
      ? {
          required: true,
          reason: "low_confidence",
          question: buildClarifyingQuestion({ ...intent, missing_info: missingInfo }),
        }
      : { required: false },
  };
}

function fallbackIntent(text = "") {
  const goal = text.trim().replace(/[.?!]+$/, "") || "Help with a VoxMind request";
  const module = inferModuleFromText(goal);
  const actionType = inferActionType(goal);

  return {
    goal,
    module,
    action_type: actionType,
    entities: { time: null, person: null, location: null, topic: goal, amount: null, language: null },
    steps: ["Understand the request", `Prepare a ${module} module result`, "Show the result and save it for follow-up"],
    constraints: [],
    missing_info: [],
    confidence: 0.72,
    spoken_response: "I can help with that. I will make a practical call and keep you posted if anything important is missing.",
  };
}

function enrichPlanSteps(plan = [], intent = {}) {
  const baseConfidence = confidenceNumber(intent.confidence, 0.74);
  return plan.map((step, index) => {
    const requiresInput = Boolean(step.requires_input);
    const confidencePenalty = requiresInput ? 0.14 : 0.03 * Math.min(index, 4);
    const confidence = confidenceNumber(step.confidence, Math.max(0.45, baseConfidence - confidencePenalty));

    return {
      ...step,
      step: Number(step.step) || index + 1,
      action: stringValue(step.action, stringValue(step.action_type, "general")),
      service: stringValue(step.service, "ai"),
      requires_input: requiresInput,
      estimated_duration_seconds: Number(step.estimated_duration_seconds) || 2 + index,
      fallback: stringValue(step.fallback, "Ask for confirmation and retry this step"),
      confidence,
      parallel_group: step.parallel_group || null,
    };
  });
}

function fallbackPlan(intent = {}) {
  const module = intent.module || inferModuleFromText(intent.goal || "");
  const goal = intent.goal || "Complete the request";

  if (isAppBuildRequest(goal)) {
    return [
      { step: 1, action: "define_default_app_scope", description: `Use sensible defaults and define the app scope for: ${goal}`, service: "ai", requires_input: false, estimated_duration_seconds: 2, fallback: "Build a clean default version and let the user refine it afterward" },
      { step: 2, action: "generate_preview_app", description: "Create a complete runnable HTML/CSS/JS app with useful default data and interactions", service: "filesystem", requires_input: false, estimated_duration_seconds: 8, fallback: "Create a single-file HTML preview if a larger scaffold is not needed" },
      { step: 3, action: "preview_app", description: "Open the generated app in the preview panel", service: "filesystem", requires_input: false, estimated_duration_seconds: 2, fallback: "Return the generated file path for manual preview" },
    ];
  }

  return [
    { step: 1, action: "parse_request", description: `Read the request and decide the most useful next move: ${goal}`, service: "ai", requires_input: false, estimated_duration_seconds: 2, fallback: "Make a reasonable assumption and mention what can be corrected later" },
    { step: 2, action: `prepare_${module}_result`, description: `Prepare a useful ${module} result without unnecessary back-and-forth`, service: module === "search" ? "web" : "ai", requires_input: false, estimated_duration_seconds: 4, fallback: "Save a clear note so the user can follow up without starting over" },
    { step: 3, action: "confirm_completion", description: "Tell the user what happened and save it in the module workspace", service: "notification", requires_input: false, estimated_duration_seconds: 1, fallback: "Log the outcome in the current session" },
  ];
}

async function extractIntentForText(text, userId = config.DEFAULT_USER_ID) {
  let memoriesContext = "";
  try {
    const memories = await recallMemory(userId, text, 5);
    if (memories.length > 0) {
      memoriesContext = `\n\nRelevant context from previous sessions:\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
      console.log(`[Intent] Injecting ${memories.length} memories`);
    }
  } catch (err) {
    console.warn("[Intent] Memory recall skipped:", errorMessage(err));
  }

  const systemPrompt = INTENT_EXTRACTION_PROMPT + memoriesContext;
  const intent = enrichIntent(await ai.chatJSON(systemPrompt, text), text);

  setImmediate(async () => {
    try {
      const conversationText = `User said: ${text}\nAI extracted intent: ${JSON.stringify(intent)}`;
      const facts = await extractFacts(conversationText);
      for (const fact of facts) {
        await saveMemory(userId, fact);
      }
    } catch (err) {
      console.warn("[Intent] Fact extraction skipped:", errorMessage(err));
    }
  });

  return intent;
}

async function generatePlanForIntent(intent = {}) {
  if (isAppBuildRequest(intent.goal || "")) {
    return enrichPlanSteps(fallbackPlan(intent), intent);
  }

  const plan = await ai.chatJSON(PLAN_GENERATION_PROMPT, JSON.stringify(intent));
  const planArray = Array.isArray(plan) ? plan : plan.plan || plan.steps || [];
  return enrichPlanSteps(planArray, intent);
}

// ── Plan Execution ──

function stepText(step) {
  return [step.description, step.action, step.action_type, step.service].filter(Boolean).join(" ").toLowerCase();
}

function externalServiceMessage(step) {
  const text = stepText(step);
  if (/calendar|meeting|schedule|invite/.test(text)) {
    return "I can prepare the calendar step, but your calendar connector is not connected yet.";
  }
  if (/email|mail|message|sms|send/.test(text)) {
    return "I can prepare the message, but sending needs a connected messaging connector.";
  }
  return null;
}

function isReminderStep(step) {
  const text = stepText(step);
  return (
    /reminder|remind/.test(text) ||
    (/schedule.*notification|notification.*time|notification.*at/.test(text) &&
      !/notify user|confirm|completion|completed/.test(text))
  );
}

async function executePlanStep(step, index, userId) {
  const text = stepText(step);

  if (step.requires_input) {
    return { step: index + 1, step_id: step.id || null, status: "waiting_for_input", message: "I need your call on this step before I run it." };
  }

  if (/search|research|web/.test(text)) {
    const searchQuery = step.query || step.description || step.goal || text;
    const result = await executeTool("search_web", { query: searchQuery }, { userId });
    return { step: index + 1, step_id: step.id || null, status: result.success ? "completed" : "failed", message: result.success ? "I found the available search results." : result.error, result };
  }

  if (isReminderStep(step)) {
    const reminder = createReminderFromStep(step, userId);
    return {
      step: index + 1, step_id: step.id || null, status: "completed",
      message: reminder.dueAt ? `I saved the reminder locally for ${new Date(reminder.dueAt).toLocaleString()}.` : "I saved the reminder locally. Add a clear time if you want an exact notification.",
      result: { success: true, reminder, note: "Local reminder fallback used because no external notification connector is configured." },
    };
  }

  const externalMessage = externalServiceMessage(step);
  if (externalMessage) {
    return { step: index + 1, step_id: step.id || null, status: "connector_required", message: externalMessage };
  }

  return { step: index + 1, step_id: step.id || null, status: "completed", message: step.description || "Step completed." };
}

function isBarrierStep(step) {
  const text = stepText(step);
  return (
    step.requires_input ||
    Boolean(step.depends_on || step.dependsOn) ||
    Boolean(externalServiceMessage(step)) ||
    /confirm|final|notify|summari[sz]e|review/.test(text)
  );
}

function buildExecutionBatches(plan) {
  const batches = [];
  let current = [];

  const flush = () => {
    if (current.length) { batches.push(current); current = []; }
  };

  plan.forEach((step, index) => {
    const entry = { step, index };
    if (isBarrierStep(step)) { flush(); batches.push([entry]); return; }
    current.push(entry);
  });

  flush();
  return batches;
}

async function executePlanBatches(plan, userId) {
  const batches = buildExecutionBatches(plan);
  const results = new Array(plan.length);
  const batchSummaries = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const settled = batch.length > 1
      ? await Promise.allSettled(batch.map(({ step, index }) => executePlanStep(step, index, userId)))
      : [await executePlanStep(batch[0].step, batch[0].index, userId).then(
          (value) => ({ status: "fulfilled", value }),
          (reason) => ({ status: "rejected", reason })
        )];

    const batchResults = settled.map((result, offset) => {
      if (result.status === "fulfilled") return result.value;
      const { step, index } = batch[offset];
      return {
        step: index + 1,
        step_id: step.id || null,
        status: "failed",
        message: errorMessage(result.reason, "Step failed"),
      };
    });

    batchResults.forEach((result, offset) => { results[batch[offset].index] = result; });
    batchSummaries.push({ batch: batchIndex + 1, mode: batch.length > 1 ? "parallel" : "sequential", steps: batch.map(({ index }) => index + 1) });
  }

  return { results, batches: batchSummaries };
}

function fallbackExecutionReview(results = []) {
  const failed = results.filter((step) => step.status === "failed");
  const blocked = results.filter((step) => ["connector_required", "waiting_for_input"].includes(step.status));
  const completed = results.filter((step) => step.status === "completed");
  const confidence = results.length ? completed.length / results.length : 0;

  return {
    status: failed.length ? "needs_attention" : blocked.length ? "partial" : "passed",
    confidence: Number(confidence.toFixed(2)),
    summary: blocked.length
      ? `${completed.length} step(s) are done. ${blocked.length} still need your input or a connector.`
      : failed.length
        ? `${failed.length} step(s) did not land cleanly. I would retry or adjust those.`
        : "Everything I could run is done.",
    issues: [
      ...failed.map((step) => `Step ${step.step} failed: ${step.message || "unknown error"}`),
      ...blocked.map((step) => `Step ${step.step} is blocked: ${step.message}`),
    ],
    corrections: failed.length ? ["Retry failed steps after checking connector/API state."] : [],
  };
}

async function reviewExecution({ plan, results, agent }) {
  const fallback = fallbackExecutionReview(results);
  if (!ai.isAvailable()) return fallback;

  try {
    const review = await ai.chatJSON(
      `You review an AI assistant execution result.\nReturn ONLY JSON with: status ("passed"|"partial"|"needs_attention"), confidence (0-1), summary, issues array, corrections array.\nBe concise, natural, and practical. Sound like a human operator reporting back, not a machine log. Do not expose hidden reasoning.`,
      JSON.stringify({ plan, results, agent }),
      { task: "review", maxTokens: 1200, temperature: 0.2 }
    );

    return {
      ...fallback,
      ...review,
      confidence: confidenceNumber(review.confidence, fallback.confidence),
      issues: Array.isArray(review.issues) ? review.issues : fallback.issues,
      corrections: Array.isArray(review.corrections) ? review.corrections : fallback.corrections,
    };
  } catch (error) {
    console.warn("[Execute] Review fallback:", errorMessage(error));
    return fallback;
  }
}

function shouldRunAgent(plan) {
  return plan.some((step) => {
    const text = stepText(step);
    if (/(remind|reminder|schedule|calendar|notification|email|message)/.test(text)) return false;
    return /(build|generate.*(code|preview|app|website|dashboard)|preview|code|filesystem|app|website|dashboard)/.test(text);
  });
}

function planToAgentInput(plan) {
  const lines = plan.map((step, index) => {
    const description = step.description || step.action || "Complete this step";
    return `${index + 1}. ${description}`;
  });
  return `Execute this approved plan and produce a preview artifact when useful:\n${lines.join("\n")}`;
}

// ── Routes ──

/**
 * POST /intent — Extract intent from text using AI
 */
router.post("/intent", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Invalid request body",
        hint: 'Send JSON with a "text" field.',
        example: { text: "Schedule a meeting with Sarah next Tuesday at 3pm" },
      });
    }

    const userId = currentUserId(req);
    console.log("[Intent] Processing request");

    const intent = await extractIntentForText(text, userId);

    console.log(`[Intent] Extracted: action_type="${intent.action_type}", confidence=${intent.confidence}`);

    res.json({
      success: true,
      intent,
      metadata: { engine: "ai_router", clarification_required: Boolean(intent.clarification?.required) },
    });
  } catch (error) {
    console.error("[Intent] Error:", errorMessage(error));
    const intent = enrichIntent(fallbackIntent(req.body?.text), req.body?.text);
    res.json({
      success: true,
      intent,
      metadata: { engine: "local_fallback", reason: errorMessage(error), memories_used: false },
    });
  }
});

/**
 * POST /plan — Generate execution plan from intent
 */
router.post("/plan", async (req, res) => {
  try {
    const { intent } = req.body;

    if (!intent || typeof intent !== "object") {
      return res.status(400).json({ error: "Invalid request body", hint: "Send JSON with an intent object." });
    }

    console.log("[Plan] Generating plan");
    const planArray = await generatePlanForIntent(intent);

    res.json({ success: true, plan: planArray, total_steps: planArray.length, metadata: { engine: "ai_router" } });
  } catch (error) {
    console.error("[Plan] Error:", errorMessage(error));
    const planArray = enrichPlanSteps(fallbackPlan(req.body?.intent), req.body?.intent);
    res.json({ success: true, plan: planArray, total_steps: planArray.length, metadata: { engine: "local_fallback", reason: errorMessage(error) } });
  }
});

/**
 * POST /chat/direct — Direct chat bypass (skip plan/execute for simple answers)
 */
router.post("/chat/direct", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Invalid request body", hint: 'Send JSON with a "text" field.' });
    }

    const userId = currentUserId(req);
    console.log("[Chat] Direct answer");

    let memoriesContext = "";
    try {
      const memories = await recallMemory(userId, text, 3);
      if (memories.length > 0) {
        memoriesContext = `\n\nRelevant context from previous conversations:\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
      }
    } catch (err) {
      console.warn("[Chat] Memory recall skipped:", errorMessage(err));
    }

    const systemPrompt = `You are NOVA, a warm, direct, and practical voice-first AI assistant. Answer the user's question naturally and concisely. If it's a calculation, show the result. If it's a factual question, give the answer. Sound like a helpful person, not a robot. Do not describe steps or plans — just answer.${memoriesContext}`;

    const answer = await ai.chat(systemPrompt, text, { task: "chat", maxTokens: 1200, temperature: 0.4 });

    res.json({ success: true, answer: answer.trim(), metadata: { engine: "ai_router", mode: "direct" } });
  } catch (error) {
    console.error("[Chat] Direct answer error:", errorMessage(error));
    res.json({ success: true, answer: "I wasn't able to process that right now. Could you try again?", metadata: { engine: "local_fallback", reason: errorMessage(error) } });
  }
});

/**
 * POST /chat/stream — SSE streaming endpoint for real-time AI responses
 */
router.post("/chat/stream", async (req, res) => {
  const text = req.body?.text;
  const userId = currentUserId(req);

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Invalid request body", hint: 'Send JSON with a "text" field.' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`data: ${JSON.stringify({ type: "start", timestamp: Date.now() })}\n\n`);

  try {
    let memoriesContext = "";
    try {
      const memories = await recallMemory(userId, text, 3);
      if (memories.length > 0) {
        memoriesContext = `\n\nRelevant context from previous conversations:\n${memories.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;
      }
    } catch {
      // Memory recall is optional for streaming
    }

    const systemPrompt = `You are NOVA, a warm, direct, and practical voice-first AI assistant. Answer the user's question naturally and concisely. Sound like a helpful person, not a robot.${memoriesContext}`;

    if (!ai.isAvailable()) {
      // Fallback: send a single chunk
      res.write(`data: ${JSON.stringify({ type: "chunk", text: "I'm running in offline mode. Please configure an AI provider to get real responses." })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", timestamp: Date.now() })}\n\n`);
      res.end();
      return;
    }

    // Stream chunks from the AI
    for await (const chunk of ai.chatStream(systemPrompt, text, { task: "chat", maxTokens: 1200, temperature: 0.4 })) {
      if (chunk) {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done", timestamp: Date.now() })}\n\n`);
  } catch (error) {
    console.error("[Stream] Error:", errorMessage(error));
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage(error) })}\n\n`);
  }

  res.end();
});

/**
 * POST /execute — Execute an approved plan
 */
router.post("/execute", async (req, res) => {
  const plan = req.body.plan || req.body.steps;
  const userId = currentUserId(req);

  if (!plan || !Array.isArray(plan)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  try {
    const executionId = `exec_${Date.now()}`;
    const io = req.app.get("io");
    const results = [];
    let agentResult = null;

    const runAgentForPlan = shouldRunAgent(plan);
    if (runAgentForPlan) {
      try {
        agentResult = await runAgent({
          input: planToAgentInput(plan),
          userId,
          onStep: (step) => {
            emitToUser(io, userId, "execution:step", { execution_id: executionId, ...step });
          },
        });
      } catch (error) {
        agentResult = {
          success: false,
          summary: "The autonomous build agent could not complete this run.",
          error: errorMessage(error),
          preview_file: null,
          steps: [],
        };
        results.push({
          step: 0,
          step_id: "agent",
          status: "failed",
          message: agentResult.error,
        });
        console.warn("[Execute] Agent fallback:", agentResult.error);
      }
    }

    const execution = agentResult?.success === false
      ? { results: [], batches: [] }
      : await executePlanBatches(plan, userId);
    results.push(...execution.results);

    const failed = results.filter((step) => step.status === "failed");
    const blocked = results.filter((step) => ["connector_required", "waiting_for_input"].includes(step.status));
    const review = await reviewExecution({ plan, results, agent: agentResult });

    res.json({
      status: failed.length ? "partial" : "ok",
      message: blocked.length
        ? `I finished ${results.length - blocked.length} step(s). ${blocked.length} still need a connector or your input.`
        : "Done. I handled the executable steps.",
      execution_id: executionId,
      steps_received: plan.length,
      batches: execution.batches,
      results,
      review,
      agent: agentResult,
    });
  } catch (error) {
    console.error("[Execute] Error:", errorMessage(error));
    res.status(500).json({ error: "Plan execution failed", details: errorMessage(error) });
  }
});

// Export helpers for use by routines workflow in server.js
router._extractIntentForText = extractIntentForText;
router._generatePlanForIntent = generatePlanForIntent;
router._executePlanBatches = executePlanBatches;
router._reviewExecution = reviewExecution;
router._enrichPlanSteps = enrichPlanSteps;

module.exports = router;

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  deleteMemory as apiDeleteMemory,
  executePlan,
  extractIntent,
  generatePlan,
  getAgentOutputUrl,
} from "@/api/client";
import {
  initialMemories,
  initialMessages,
  initialSessions,
  uid,
} from "@/lib/seed";

const defaultSettings = {
  apiKeys: { anthropic: "", openai: "", elevenlabs: "" },
  selectedModel: "claude-sonnet-4-20250514",
  sttMode: "browser",
  ttsEnabled: true,
  ttsMode: "browser",
  autopilotEnabled: true,
  voiceActivationEnabled: false,
  memoryEnabled: true,
  fontSize: "medium",
};

const normalizeTimestamp = (timestamp) =>
  typeof timestamp === "number"
    ? new Date(timestamp).toISOString()
    : timestamp || new Date().toISOString();

const normalizeMessage = (message) => ({
  ...message,
  id: message.id || uid(),
  content: message.content ?? message.text ?? "",
  text: message.text ?? message.content ?? "",
  timestamp: normalizeTimestamp(message.timestamp),
});

const normalizeSession = (session) => ({
  ...session,
  id: session.id || uid(),
  createdAt: normalizeTimestamp(session.createdAt),
  messages: (session.messages || []).map(normalizeMessage),
});

const normalizePlan = (response) => {
  const plan = Array.isArray(response)
    ? response
    : response?.plan || response?.steps || [];

  return plan.map((step, index) => ({
    id: step.id || uid(),
    step: step.step || index + 1,
    action: step.action || step.action_type || "general",
    action_type: step.action_type || step.action || "general",
    description: step.description || "Complete this step",
    service: step.service || "ai",
    requires_input: Boolean(step.requires_input),
    estimated_duration_seconds: step.estimated_duration_seconds || 2 + index,
    fallback: step.fallback || "Ask for confirmation and retry this step",
    confidence: Number.isFinite(Number(step.confidence)) ? Number(step.confidence) : 0.72,
    parallel_group: step.parallel_group || null,
  }));
};

const getErrorMessage = (error, fallback) =>
  error?.hint ? `${error.message} ${error.hint}` : error?.message || fallback;

const getCasualReply = (text = "") => {
  const clean = text.trim().toLowerCase().replace(/[.!?'"`]+$/g, "");

  if (/^(hi|hello|hey|yo|sup|hii|hiii|good morning|good afternoon|good evening)$/.test(clean)) {
    return "Hey, I'm here. Tell me what you want to build, fix, research, or automate.";
  }

  if (/^(thanks|thank you|thx|ok|okay|cool|nice|great)$/.test(clean)) {
    return "You got it. I'm ready when you are.";
  }

  if (/^(who are you|what can you do)$/.test(clean)) {
    return "I'm your voice-first AI workspace. I can take a requirement by file, voice, or text, turn it into a plan, and help build or preview the result.";
  }

  return null;
};

const titleFromGoal = (goal = "AI workspace") => {
  const clean = goal
    .replace(/\b(build|create|make|generate|develop)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "Autonomous AI Workspace";

  return clean
    .split(" ")
    .slice(0, 7)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const extractFeatureHints = (text = "") => {
  const lower = text.toLowerCase();
  const features = [];

  if (/(voice|speak|speech|audio)/.test(lower)) {
    features.push("Voice command intake");
  }
  if (/(upload|file|document|requirements|pdf|prd|spec)/.test(lower)) {
    features.push("Requirement file parser");
  }
  if (/(preview|prototype|demo|ui|screen)/.test(lower)) {
    features.push("Live preview generator");
  }
  if (/(automatic|autonomous|itself|own|agent|decide)/.test(lower)) {
    features.push("Autonomous planning engine");
  }
  if (/(deploy|production|end product|launch)/.test(lower)) {
    features.push("Deployment checklist");
  }

  return [
    ...features,
    "Codebase agent workspace",
    "Terminal and test runner",
    "Pull request reviewer",
    "Browser preview loop",
    "Subagents and worktrees",
    "Connector marketplace",
    "Intent classifier",
    "Execution queue",
    "Safety and permission checks",
  ].slice(0, 12);
};

const moduleKeywords = [
  ["health", /(health|symptom|medicine|medication|water|sleep|mood|exercise|bmi|calorie|doctor)/],
  ["finance", /(finance|expense|income|budget|spending|bill|currency|money|invoice)/],
  ["learn", /(learn|lesson|quiz|flashcard|teach|study|explain|homework)/],
  ["home", /(home assistant|smart home|light|thermostat|room|device|scene)/],
  ["travel", /(travel|trip|itinerary|flight|hotel|visa|packing|destination|weather)/],
  ["media", /(music|movie|tv|book|podcast|youtube|spotify|news|entertainment)/],
  ["translate", /(translate|translation|language|phrase|pronunciation|conversation mode)/],
  ["business", /(business|meeting summary|crm|contact|report|csv|data analysis|proposal)/],
  ["write", /(write|draft|email|essay|blog|post|cover letter|content|generate code)/],
  ["search", /(search|research|find|look up|source|latest)/],
  ["task", /(task|schedule|meeting|remind|reminder|calendar|checklist)/],
];

const inferModule = (intent = {}, sourceText = "") => {
  if (intent.module) return intent.module;

  const text = `${intent.goal || ""} ${intent.action_type || ""} ${sourceText}`.toLowerCase();
  const match = moduleKeywords.find(([, pattern]) => pattern.test(text));
  if (match) return match[0];

  if (intent.action_type === "create") return "write";
  if (intent.action_type === "search") return "search";
  if (["schedule", "remind", "automate"].includes(intent.action_type)) return "task";
  return "chat";
};

const createPreviewArtifact = ({
  intent,
  sourceText,
  plan = [],
  status = "planned",
  execution = null,
}) => {
  const goal = intent?.goal || sourceText || "Build an autonomous AI platform";
  const title = titleFromGoal(goal);
  const featureHints = extractFeatureHints(`${goal} ${sourceText}`);
  const planActions = plan.map((step) => step.action?.replace(/_/g, " ")).filter(Boolean);
  const previewFile = execution?.agent?.preview_file || execution?.preview_file || null;

  return {
    id: uid(),
    title,
    status,
    source: sourceText?.startsWith("Requirements file:")
      ? "Uploaded requirement"
      : "Command",
    summary:
      "A one-command agent workspace that accepts files, voice, or text, understands codebases, plans work, runs guarded developer tools, reviews changes, and keeps a preview visible while work is happening.",
    features: featureHints,
    workflow: [
      "Capture requirement",
      "Extract intent",
      "Design execution plan",
      "Run approved steps",
      "Preview result",
    ],
    screens: [
      "Command center",
      "Requirement inbox",
      "Planner board",
      "Code workspace",
      "Terminal runner",
      "Review queue",
      "Live preview",
      "Execution history",
    ],
    automation: planActions.length ? planActions.slice(0, 5) : [
      "analyze requirements",
      "generate preview",
      "validate workflow",
      "prepare build backlog",
    ],
    stack: [
      "React",
      "Node API",
      "Agent planner",
      "Voice I/O",
      "Memory",
      "Git tools",
      "Browser automation",
      "Connector layer",
    ],
    previewFile,
    previewUrl: getAgentOutputUrl(previewFile),
    agentSummary: execution?.agent?.summary || null,
    updatedAt: new Date().toISOString(),
  };
};

const createModuleRecord = ({ module, intent, sourceText, plan = [], execution }) => {
  const goal = intent?.goal || sourceText || "New VoxMind request";
  const createdAt = new Date().toISOString();
  const planText = plan.map((step) => step.description || step.action).filter(Boolean);

  return {
    id: uid(),
    module,
    title: titleFromGoal(goal),
    goal,
    status: execution?.status || "ready",
    createdAt,
    spokenResponse:
      intent?.spoken_response ||
      "Done. I prepared the result and saved it in the right module.",
    summary:
      execution?.message ||
      `Prepared a ${module} result with ${planText.length || 1} action step(s).`,
    steps: planText,
    entities: intent?.entities || {},
    sourceText,
    execution,
  };
};

const seededMessages = initialMessages.map(normalizeMessage);
const seededSessions = initialSessions.map(normalizeSession);

export const useAppStore = create(
  persist(
    (set, get) => ({
      messages: seededMessages,
      currentPlan: null,
      isLoading: false,
      isRecording: false,
      speakingId: null,
      settings: defaultSettings,
      sttMode: defaultSettings.stt,
      memories: initialMemories,
      sessions: seededSessions,
      hasOnboarded: false,
      darkMode: true,
      isPanelOpen: null,
      viewingSessionId: null,
      currentSessionId: seededSessions[0]?.id || null,
      lastIntent: null,
      lastExecution: null,
      previewArtifact: null,
      activeModule: "chat",
      moduleRecords: {},
      loadingStage: null,
      planApproved: false,
      pendingClarification: null,
      error: null,

      setRecording: (value) => set({ isRecording: value }),
      setSpeakingId: (id) => set({ speakingId: id }),
      openPanel: (name) => set({ isPanelOpen: name }),
      closePanel: () => set({ isPanelOpen: null }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      toggleAutopilot: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            autopilotEnabled: !state.settings.autopilotEnabled,
          },
        })),
      toggleVoiceActivation: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            voiceActivationEnabled: !state.settings.voiceActivationEnabled,
          },
        })),
      setSelectedModel: (model) =>
        set((state) => ({
          settings: { ...state.settings, selectedModel: model },
        })),

      setActiveModule: (module) => set({ activeModule: module || "chat" }),

      addModuleRecord: (record) =>
        set((state) => {
          const module = record.module || state.activeModule || "chat";
          const existing = state.moduleRecords[module] || [];
          return {
            activeModule: module,
            moduleRecords: {
              ...state.moduleRecords,
              [module]: [record, ...existing].slice(0, 20),
            },
          };
        }),

      setSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        })),

      setApiKey: (provider, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            apiKeys: { ...state.settings.apiKeys, [provider]: value },
          },
        })),

      completeOnboarding: () => set({ hasOnboarded: true }),

      addMessage: (roleOrMessage, content, meta = {}) => {
        const message =
          typeof roleOrMessage === "object"
            ? roleOrMessage
            : { role: roleOrMessage, content, text: content, ...meta };

        set((state) => ({
          messages: [...state.messages, normalizeMessage(message)],
        }));
      },

      submitInput: async (text) => {
        const clean = (text || "").trim();
        if (!clean || get().isLoading) return;
        const pendingClarification = get().pendingClarification;
        const effectiveText = pendingClarification
          ? `${pendingClarification.originalText}\n\nClarification answer: ${clean}`
          : clean;
        const casualReply = getCasualReply(clean);

        const userMsg = normalizeMessage({
          role: "user",
          text: clean,
          content: clean,
          timestamp: Date.now(),
        });

        set((state) => ({
          messages: [...state.messages, userMsg],
          currentPlan: null,
          previewArtifact: null,
          viewingSessionId: null,
          error: null,
          planApproved: false,
        }));

        if (!pendingClarification && casualReply) {
          get().addMessage({
            role: "assistant",
            text: casualReply,
            content: casualReply,
            type: "chat",
            timestamp: Date.now(),
          });
          get()._snapshotSession();
          return;
        }

        set({
          isLoading: true,
          loadingStage: "intent",
        });

        try {
          const intentResponse = await extractIntent(effectiveText);
          const rawIntent = intentResponse.intent || intentResponse;
          const intent = {
            ...rawIntent,
            module: inferModule(rawIntent, effectiveText),
          };

          if (!intent?.goal) {
            throw new Error("The backend did not return an intent.");
          }

          get().addMessage({
            role: "assistant",
            text: "Got it. I understand what you're aiming for.",
            content: "Got it. I understand what you're aiming for.",
            type: "intent",
            intent,
            timestamp: Date.now(),
          });

          set({ lastIntent: intent, loadingStage: "plan" });

          if (!pendingClarification && intent.clarification?.required) {
            const suggestion =
              intent.clarification.question ||
              "I made a sensible default. You can adjust it after I show the result.";
            get().addMessage({
              role: "assistant",
              text: `Suggestion: ${suggestion}`,
              content: `Suggestion: ${suggestion}`,
              type: "suggestion",
              timestamp: Date.now(),
            });
          }

          if (pendingClarification) {
            set({ pendingClarification: null });
          }

          const planResponse = await generatePlan(intent);
          const plan = normalizePlan(planResponse);

          if (!plan.length) {
            throw new Error("The backend did not return a usable plan.");
          }

          get().addMessage({
            role: "assistant",
            text: `I mapped that into ${plan.length} steps. I'll keep the preview visible while I work through it.`,
            content: `I mapped that into ${plan.length} steps. I'll keep the preview visible while I work through it.`,
            type: "plan_intro",
            timestamp: Date.now(),
          });

          set({
            currentPlan: plan,
            activeModule: intent.module,
            previewArtifact: createPreviewArtifact({
              intent,
              sourceText: clean,
              plan,
              status: "planned",
            }),
            isLoading: false,
            loadingStage: null,
          });

          if (get().settings.autopilotEnabled) {
            get().addMessage({
              role: "assistant",
              text: "I'm on it. Running the safe preview build now.",
              content: "I'm on it. Running the safe preview build now.",
              type: "autopilot",
              timestamp: Date.now(),
            });

            setTimeout(() => {
              get().approvePlan();
            }, 500);
          }
        } catch (error) {
          const message = getErrorMessage(
            error,
            "Something went wrong. Please try again."
          );

          get().addMessage({
            role: "system",
            text: message,
            content: message,
            type: "error",
            timestamp: Date.now(),
          });

          set({
            isLoading: false,
            loadingStage: null,
            error: message,
          });
        }
      },

      processUserInput: (text) => get().submitInput(text),

      updatePlanStep: (id, description) =>
        set((state) => ({
          currentPlan: state.currentPlan
            ? state.currentPlan.map((step) =>
                step.id === id ? { ...step, description } : step
              )
            : state.currentPlan,
        })),

      approvePlan: async (selectedStepIds = null) => {
        const fullPlan = get().currentPlan;
        const plan = selectedStepIds?.length
          ? fullPlan?.filter((step) => selectedStepIds.includes(step.id))
          : fullPlan;
        if (!plan?.length) return;

        set({ isLoading: true, loadingStage: "execute", error: null });

        try {
          const result = await executePlan(plan);
          const executionId = result.execution_id || `exec_${uid()}`;
          const reviewSummary = result.review?.summary ? ` Review: ${result.review.summary}` : "";
          const message = `${result.message || "Done. I finished the safe preview run."}${reviewSummary}`;
          const intent = get().lastIntent;
          const sourceText =
            get().messages.findLast?.((message) => message.role === "user")?.content ||
            get().messages.filter((message) => message.role === "user").at(-1)?.content ||
            intent?.goal ||
            "";

          get().addMessage({
            role: "assistant",
            text: message,
            content: `${message} ID: ${executionId}${
              selectedStepIds?.length ? ` Executed ${plan.length} selected step(s).` : ""
            }`,
            status: "completed",
            type: "execution_confirmation",
            executionId,
            execution: result,
            plan,
            fullPlan,
            timestamp: Date.now(),
          });

          const module = inferModule(intent, sourceText);
          const record = createModuleRecord({
            module,
            intent,
            sourceText,
            plan,
            execution: result,
          });

          set({
            currentPlan: null,
            lastExecution: result,
            activeModule: module,
            moduleRecords: {
              ...get().moduleRecords,
              [module]: [record, ...(get().moduleRecords[module] || [])].slice(0, 20),
            },
            previewArtifact: createPreviewArtifact({
              intent,
              sourceText,
              plan,
              status: "ready",
              execution: result,
            }),
            isLoading: false,
            loadingStage: null,
            planApproved: true,
          });

          get()._snapshotSession();
        } catch (error) {
          const message = getErrorMessage(error, "Execution failed.");

          get().addMessage({
            role: "system",
            text: message,
            content: message,
            type: "error",
            timestamp: Date.now(),
          });

          set({
            isLoading: false,
            loadingStage: null,
            error: message,
          });
        }
      },

      cancelPlan: () => {
        get().addMessage({
          role: "assistant",
          text: "No problem, cancelled.",
          content: "No problem, cancelled.",
          status: "cancelled",
          type: "plan_cancelled",
          timestamp: Date.now(),
        });

        set({ currentPlan: null, planApproved: false });
        get()._snapshotSession();
      },

      _snapshotSession: () => {
        const { messages, currentSessionId, sessions } = get();
        const firstUser = messages.find((message) => message.role === "user");
        if (!firstUser) return;

        const title = firstUser.text || firstUser.content;

        if (currentSessionId) {
          set({
            sessions: sessions.map((session) =>
              session.id === currentSessionId
                ? { ...session, title, messages }
                : session
            ),
          });
          return;
        }

        const id = uid();
        set({
          currentSessionId: id,
          sessions: [
            { id, title, createdAt: new Date().toISOString(), messages },
            ...sessions,
          ],
        });
      },

      newConversation: () =>
        set({
          messages: [],
          currentPlan: null,
          previewArtifact: null,
          activeModule: "chat",
          currentSessionId: null,
          viewingSessionId: null,
          isPanelOpen: null,
          error: null,
          pendingClarification: null,
        }),

      clearMessages: () =>
        set({
          messages: [],
          currentPlan: null,
          viewingSessionId: null,
          previewArtifact: null,
          activeModule: "chat",
          error: null,
          planApproved: false,
          pendingClarification: null,
        }),

      resetToSeed: () =>
        set({
          messages: seededMessages,
          memories: initialMemories,
          sessions: seededSessions,
          currentSessionId: seededSessions[0]?.id || null,
          viewingSessionId: null,
          currentPlan: null,
          lastIntent: null,
          lastExecution: null,
          previewArtifact: null,
          activeModule: "chat",
          moduleRecords: {},
          error: null,
          planApproved: false,
          pendingClarification: null,
        }),

      viewSession: (id) =>
        set({ viewingSessionId: id, isPanelOpen: null, currentPlan: null }),

      exitSessionView: () => set({ viewingSessionId: null }),

      deleteMemory: async (id, userId = "default-user") => {
        try {
          await apiDeleteMemory(userId, id);
        } catch {
          // Mock and offline deletion still update local state.
        }

        set((state) => ({
          memories: state.memories.filter((memory) => memory.id !== id),
        }));
      },

      clearMemories: () => set({ memories: [] }),

      toggleSttMode: () =>
        set((state) => {
          const stt = state.settings.sttMode === "browser" ? "whisper" : "browser";
          return { settings: { ...state.settings, sttMode: stt }, sttMode: stt };
        }),

      setSttMode: (mode) =>
        set((state) => ({
          settings: { ...state.settings, sttMode: mode },
          sttMode: mode,
        })),

      /** Toggle TTS on/off */
      toggleTtsEnabled: () =>
        set((state) => ({
          settings: { ...state.settings, ttsEnabled: !state.settings.ttsEnabled },
        })),

      /** Toggle TTS engine between browser and elevenlabs */
      toggleTtsMode: () =>
        set((state) => {
          const mode = state.settings.ttsMode === "browser" ? "elevenlabs" : "browser";
          return { settings: { ...state.settings, ttsMode: mode } };
        }),

      /** Set the ID of the message currently being spoken */
      setSpeakingMessageId: (id) => set({ speakingId: id }),
    }),
    {
      name: "voxmind-store",
      partialize: (state) => ({
        messages: state.messages,
        settings: {
          ...state.settings,
          apiKeys: defaultSettings.apiKeys,
        },
        memories: state.memories,
        sessions: state.sessions,
        hasOnboarded: state.hasOnboarded,
        darkMode: state.darkMode,
        currentSessionId: state.currentSessionId,
        activeModule: state.activeModule,
        moduleRecords: state.moduleRecords,
      }),
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted || {}) };
        const settings = {
          ...defaultSettings,
          ...(state.settings || {}),
          apiKeys: {
            ...defaultSettings.apiKeys,
            ...(state.settings?.apiKeys || {}),
          },
        };

        return {
          ...state,
          settings,
          sttMode: settings.sttMode,
          messages: (state.messages || seededMessages).map(normalizeMessage),
          sessions: (state.sessions || seededSessions).map(normalizeSession),
          activeModule: state.activeModule || "chat",
          moduleRecords: state.moduleRecords || {},
        };
      },
    }
  )
);

export default useAppStore;

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  deleteMemory as apiDeleteMemory,
  executePlan,
  extractIntent,
  generatePlan,
} from "@/api/client";
import {
  initialMemories,
  initialMessages,
  initialSessions,
  uid,
} from "@/lib/seed";

const defaultSettings = {
  apiKeys: { anthropic: "", openai: "", elevenlabs: "" },
  sttMode: "browser",
  ttsEnabled: true,
  ttsMode: "browser",
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
  }));
};

const getErrorMessage = (error, fallback) =>
  error?.hint ? `${error.message} ${error.hint}` : error?.message || fallback;

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
      loadingStage: null,
      planApproved: false,
      error: null,

      setRecording: (value) => set({ isRecording: value }),
      setSpeakingId: (id) => set({ speakingId: id }),
      openPanel: (name) => set({ isPanelOpen: name }),
      closePanel: () => set({ isPanelOpen: null }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

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

        const userMsg = normalizeMessage({
          role: "user",
          text: clean,
          content: clean,
          timestamp: Date.now(),
        });

        set((state) => ({
          messages: [...state.messages, userMsg],
          isLoading: true,
          loadingStage: "intent",
          currentPlan: null,
          viewingSessionId: null,
          error: null,
          planApproved: false,
        }));

        try {
          const intentResponse = await extractIntent(clean);
          const intent = intentResponse.intent || intentResponse;

          if (!intent?.goal) {
            throw new Error("The backend did not return an intent.");
          }

          get().addMessage({
            role: "assistant",
            text: "Intent captured.",
            content: "Intent captured.",
            type: "intent",
            intent,
            timestamp: Date.now(),
          });

          set({ lastIntent: intent, loadingStage: "plan" });

          const planResponse = await generatePlan(intent);
          const plan = normalizePlan(planResponse);

          if (!plan.length) {
            throw new Error("The backend did not return a usable plan.");
          }

          get().addMessage({
            role: "assistant",
            text: `Plan prepared with ${plan.length} steps.`,
            content: `Plan prepared with ${plan.length} steps.`,
            type: "plan_intro",
            timestamp: Date.now(),
          });

          set({
            currentPlan: plan,
            isLoading: false,
            loadingStage: null,
          });
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

      approvePlan: async () => {
        const plan = get().currentPlan;
        if (!plan?.length) return;

        set({ isLoading: true, loadingStage: "execute", error: null });

        try {
          const result = await executePlan(plan);
          const executionId = result.execution_id || `exec_${uid()}`;
          const message = result.message || "Done! I've carried out your plan.";

          get().addMessage({
            role: "assistant",
            text: message,
            content: `${message} ID: ${executionId}`,
            status: "completed",
            type: "execution_confirmation",
            executionId,
            plan,
            timestamp: Date.now(),
          });

          set({
            currentPlan: null,
            lastExecution: result,
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
          currentSessionId: null,
          viewingSessionId: null,
          isPanelOpen: null,
          error: null,
        }),

      clearMessages: () =>
        set({
          messages: [],
          currentPlan: null,
          viewingSessionId: null,
          error: null,
          planApproved: false,
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
          error: null,
          planApproved: false,
        }),

      viewSession: (id) =>
        set({ viewingSessionId: id, isPanelOpen: null, currentPlan: null }),

      exitSessionView: () => set({ viewingSessionId: null }),

      deleteMemory: async (id) => {
        try {
          await apiDeleteMemory(id);
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
        settings: state.settings,
        memories: state.memories,
        sessions: state.sessions,
        hasOnboarded: state.hasOnboarded,
        darkMode: state.darkMode,
        currentSessionId: state.currentSessionId,
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
        };
      },
    }
  )
);

export default useAppStore;

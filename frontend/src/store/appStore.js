import { create } from "zustand";
import { executePlan, extractIntent, generatePlan } from "@/api/client";

const makeId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizePlan = (plan) => (Array.isArray(plan) ? plan : []);

const useAppStore = create((set, get) => ({
  messages: [],
  currentPlan: null,
  lastIntent: null,
  lastExecution: null,
  isLoading: false,
  loadingStage: null,
  planApproved: false,
  error: null,
  sttMode: "browser", // "browser" (Web Speech API) or "whisper" (OpenAI Whisper)

  addMessage: (role, content, meta = {}) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: makeId("msg"),
          role,
          content,
          timestamp: new Date().toISOString(),
          ...meta,
        },
      ],
    }));
  },

  processUserInput: async (text) => {
    const { addMessage } = get();
    const trimmed = text.trim();

    if (!trimmed) return;

    addMessage("user", trimmed);

    set({
      isLoading: true,
      loadingStage: "intent",
      error: null,
      currentPlan: null,
      lastIntent: null,
      planApproved: false,
    });

    try {
      const intentResponse = await extractIntent(trimmed);
      const intent = intentResponse.intent;

      if (!intent) {
        throw new Error("The backend did not return an intent.");
      }

      set({ lastIntent: intent });

      addMessage("assistant", "Intent captured.", {
        type: "intent",
        intent,
      });

      set({ loadingStage: "plan" });
      const planResponse = await generatePlan(intent);
      const plan = normalizePlan(planResponse.plan);

      if (!plan.length) {
        throw new Error("The backend did not return a usable plan.");
      }

      addMessage("assistant", `Plan prepared with ${plan.length} steps.`, {
        type: "plan_intro",
      });

      set({
        currentPlan: plan,
        isLoading: false,
        loadingStage: null,
      });
    } catch (err) {
      const errorMsg = err.hint
        ? `${err.message} ${err.hint}`
        : err.message || "Something went wrong. Please try again.";

      addMessage("system", errorMsg, { type: "error" });
      set({
        isLoading: false,
        loadingStage: null,
        error: errorMsg,
      });
    }
  },

  approvePlan: async () => {
    const { currentPlan, addMessage } = get();

    if (!currentPlan?.length) return;

    set({ isLoading: true, loadingStage: "execute", error: null });

    try {
      const result = await executePlan(currentPlan);
      const executionId = result.execution_id || makeId("exec");

      addMessage("assistant", `Execution accepted. ID: ${executionId}`, {
        type: "execution_confirmation",
        executionId,
      });

      set({
        currentPlan: null,
        lastExecution: result,
        planApproved: true,
        isLoading: false,
        loadingStage: null,
      });
    } catch (err) {
      const errorMsg = err.hint
        ? `${err.message} ${err.hint}`
        : err.message || "Execution failed.";

      addMessage("system", errorMsg, { type: "error" });
      set({
        isLoading: false,
        loadingStage: null,
        error: errorMsg,
      });
    }
  },

  cancelPlan: () => {
    const { addMessage } = get();

    addMessage("assistant", "Plan cancelled.", {
      type: "plan_cancelled",
    });

    set({ currentPlan: null, planApproved: false });
  },

  clearMessages: () => {
    set({
      messages: [],
      currentPlan: null,
      lastIntent: null,
      lastExecution: null,
      planApproved: false,
      error: null,
    });
  },

  /** Toggle between "browser" and "whisper" STT modes */
  toggleSttMode: () => {
    set((state) => ({
      sttMode: state.sttMode === "browser" ? "whisper" : "browser",
    }));
  },

  setSttMode: (mode) => {
    set({ sttMode: mode });
  },
}));

export default useAppStore;

import { create } from "zustand";
import { extractIntent, generatePlan, executePlan } from "../api/client";

/**
 * Central application store using Zustand.
 *
 * State shape:
 *   messages[]     — conversation history (user + AI messages)
 *   currentPlan    — the latest generated plan (or null)
 *   isLoading      — true while any API request is in flight
 *   loadingStage   — which stage we're in: "intent" | "plan" | "execute" | null
 *   planApproved   — true after user approves a plan
 *   error          — last error message (or null)
 */
const useAppStore = create((set, get) => ({
  // ── State ──
  messages: [],
  currentPlan: null,
  isLoading: false,
  loadingStage: null,
  planApproved: false,
  error: null,

  // ── Actions ──

  /**
   * Add a message to the conversation.
   * @param {"user"|"ai"|"system"} role
   * @param {string} content
   * @param {object} [meta] — optional metadata (intent, plan, etc.)
   */
  addMessage: (role, content, meta = {}) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          role,
          content,
          timestamp: new Date().toISOString(),
          ...meta,
        },
      ],
    }));
  },

  /**
   * Main flow: user submits text → extract intent → generate plan.
   */
  processUserInput: async (text) => {
    const { addMessage } = get();

    // Add user message
    addMessage("user", text);

    set({ isLoading: true, loadingStage: "intent", error: null, currentPlan: null, planApproved: false });

    try {
      // Step 1: Extract intent
      const intentResponse = await extractIntent(text);
      const intent = intentResponse.intent;

      addMessage("ai", `I understood your request. Here's what I extracted:`, {
        type: "intent",
        intent,
      });

      // Step 2: Generate plan
      set({ loadingStage: "plan" });
      const planResponse = await generatePlan(intent);
      const plan = planResponse.plan;

      addMessage("ai", `I've created an execution plan with ${plan.length} steps. Please review:`, {
        type: "plan_intro",
      });

      set({ currentPlan: plan, isLoading: false, loadingStage: null });
    } catch (err) {
      const errorMsg = err.message || "Something went wrong. Please try again.";
      addMessage("system", errorMsg, { type: "error" });
      set({ isLoading: false, loadingStage: null, error: errorMsg });
    }
  },

  /**
   * Approve the current plan and send it for execution.
   */
  approvePlan: async () => {
    const { currentPlan, addMessage } = get();
    if (!currentPlan) return;

    set({ isLoading: true, loadingStage: "execute" });

    try {
      const result = await executePlan(currentPlan);

      addMessage("ai", `✅ Plan approved and sent for execution!\nExecution ID: ${result.execution_id}`, {
        type: "execution_confirmation",
      });

      set({
        currentPlan: null,
        planApproved: true,
        isLoading: false,
        loadingStage: null,
      });
    } catch (err) {
      const errorMsg = err.message || "Execution failed.";
      addMessage("system", errorMsg, { type: "error" });
      set({ isLoading: false, loadingStage: null, error: errorMsg });
    }
  },

  /**
   * Cancel the current plan.
   */
  cancelPlan: () => {
    const { addMessage } = get();
    addMessage("ai", "Plan cancelled. Let me know if you'd like to try something different.", {
      type: "plan_cancelled",
    });
    set({ currentPlan: null, planApproved: false });
  },

  /**
   * Clear all conversation messages.
   */
  clearMessages: () => {
    set({ messages: [], currentPlan: null, planApproved: false, error: null });
  },
}));

export default useAppStore;

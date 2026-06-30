// ============================================
// VoiceAI Platform — Socket.IO Client Hook
// ============================================
//
// Connects to the backend Socket.IO server and listens
// for real-time agent/orchestrator/execution events.

import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import useAppStore from "@/store/appStore";

const SOCKET_URL =
  import.meta.env.VITE_BACKEND_URL?.replace("/api", "") ||
  window.location.origin;

/**
 * useSocket — connects once, auto-reconnects, dispatches events to the store.
 *
 * Events handled:
 *   agent:step           — individual agent tool call progress
 *   orchestrator:step    — multi-agent DAG progress
 *   execution:step       — plan execution step progress
 *   stream:intent:complete — streamed intent result
 *   stream:plan:complete   — streamed plan result
 *   stream:error           — server-side error
 */
export default function useSocket() {
  const socketRef = useRef(null);
  const addMessage = useAppStore((s) => s.addMessage);
  const authToken = useAppStore((s) => s.auth?.token);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      autoConnect: true,
      auth: authToken ? { token: authToken } : {},
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket.IO] Connection error:", err.message);
    });

    // ── Agent step events ──
    socket.on("agent:step", (step) => {
      console.log(`[Socket.IO] agent:step — ${step.type}: ${step.tool || step.message || ""}`);

      // Only surface meaningful progress to the user
      if (step.type === "agent_iteration_complete" || step.type === "agent_complete") {
        const summary = step.summary || step.message || "Agent step completed.";
        addMessage({
          role: "assistant",
          text: summary,
          content: summary,
          type: "agent_progress",
          timestamp: Date.now(),
          agentData: step,
        });
      }
    });

    // ── Orchestrator events ──
    socket.on("orchestrator:step", (step) => {
      console.log(`[Socket.IO] orchestrator:step — ${step.type}`);

      if (step.type === "orchestrator_step_complete") {
        const msg = `${step.agentIcon || "⚙️"} ${step.agentName || "Agent"}: ${step.description || "Step completed"}`;
        addMessage({
          role: "assistant",
          text: msg,
          content: msg,
          type: "orchestrator_progress",
          timestamp: Date.now(),
          orchestratorData: step,
        });
      }

      if (step.type === "orchestrator_complete") {
        const duration = step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : "";
        const msg = `✅ Orchestration complete — ${step.totalSteps} steps, ${step.agents_used?.length || 0} agents${duration ? ` in ${duration}` : ""}.`;
        addMessage({
          role: "assistant",
          text: msg,
          content: msg,
          type: "orchestrator_complete",
          timestamp: Date.now(),
          orchestratorData: step,
        });
      }
    });

    // ── Execution step events ──
    socket.on("execution:step", (step) => {
      console.log(`[Socket.IO] execution:step — ${step.type || "step"}`);
    });

    // ── Stream events (intent/plan via socket) ──
    socket.on("stream:intent:complete", (data) => {
      console.log("[Socket.IO] stream:intent:complete");
    });

    socket.on("stream:plan:complete", (data) => {
      console.log("[Socket.IO] stream:plan:complete");
    });

    socket.on("stream:error", (data) => {
      console.error("[Socket.IO] stream:error:", data.error);
    });

    socketRef.current = socket;
  }, [addMessage, authToken]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    connected: socketRef.current?.connected ?? false,
  };
}

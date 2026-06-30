// ============================================
// VoiceAI Platform — SSE Streaming Hook
// ============================================
//
// Connects to GET /chat/stream via Server-Sent Events
// and returns tokens as they arrive from the AI.

import { useCallback, useRef, useState } from "react";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "/api";

/**
 * useStreaming — sends a text query to the SSE endpoint
 * and returns the response as it streams in.
 *
 * Usage:
 *   const { streamChat, isStreaming, streamedText, abort } = useStreaming();
 *   await streamChat("What is React?");
 */
export default function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const controllerRef = useRef(null);

  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  /**
   * Stream a chat response from the backend SSE endpoint.
   *
   * @param {string} text — user's message
   * @param {object} options
   * @param {function} options.onChunk — called with each text chunk
   * @param {function} options.onDone — called when streaming completes with full text
   * @param {function} options.onError — called on error
   * @param {string} options.userId
   * @returns {Promise<string>} — the full assembled response
   */
  const streamChat = useCallback(async (text, { onChunk, onDone, onError, userId } = {}) => {
    abort(); // Cancel any in-flight stream

    const controller = new AbortController();
    controllerRef.current = controller;

    const params = new URLSearchParams({ text });
    if (userId) params.set("userId", userId);

    const url = `${BASE_URL}/chat/stream?${params.toString()}`;

    setIsStreaming(true);
    setStreamedText("");

    let fullText = "";

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "chunk" && data.text) {
              fullText += data.text;
              setStreamedText(fullText);
              onChunk?.(data.text, fullText);
            }

            if (data.type === "done") {
              setIsStreaming(false);
              onDone?.(fullText);
              return fullText;
            }

            if (data.type === "error") {
              throw new Error(data.message || "Stream error");
            }
          } catch (parseErr) {
            if (parseErr.message?.includes("Stream error")) throw parseErr;
            // Skip malformed SSE lines
          }
        }
      }

      // Stream ended without explicit "done" event
      setIsStreaming(false);
      onDone?.(fullText);
      return fullText;
    } catch (err) {
      if (err.name === "AbortError") {
        // User cancelled — not an error
        setIsStreaming(false);
        return fullText;
      }

      console.error("[useStreaming] Error:", err.message);
      setIsStreaming(false);
      onError?.(err);
      throw err;
    }
  }, [abort]);

  return { streamChat, isStreaming, streamedText, abort };
}

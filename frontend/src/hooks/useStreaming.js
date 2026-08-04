// ============================================
// VoiceAI Platform — SSE Streaming Hook
// ============================================
//
// Connects to POST /chat/stream via Server-Sent Events
// and returns tokens as they arrive from the AI.

import { useCallback, useRef, useState } from "react";
import { getStreamingHeaders } from "@/api/client";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "/api";
const STREAM_TIMEOUT_MS = 45_000; // 45 seconds — covers slow Gemini cold starts

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
  const timeoutRef = useRef(null);

  const clearStreamTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const abort = useCallback(() => {
    clearStreamTimeout();
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
   * @returns {Promise<string>} — the full assembled response
   */
  const streamChat = useCallback(async (text, { onChunk, onDone, onError } = {}) => {
    abort(); // Cancel any in-flight stream

    const controller = new AbortController();
    controllerRef.current = controller;

    const url = `${BASE_URL}/chat/stream`;

    setIsStreaming(true);
    setStreamedText("");

    let fullText = "";

    // Set a hard timeout so slow/stalled backends don't hang indefinitely
    timeoutRef.current = setTimeout(() => {
      console.warn("[useStreaming] Timeout — aborting stream after", STREAM_TIMEOUT_MS, "ms");
      controller.abort();
      setIsStreaming(false);
      const err = new Error("Stream timed out. The AI is taking too long — please try again.");
      onError?.(err);
    }, STREAM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        credentials: "include",
        headers: getStreamingHeaders(),
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Stream failed: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Reset the timeout on every chunk received
        clearStreamTimeout();
        timeoutRef.current = setTimeout(() => {
          console.warn("[useStreaming] Mid-stream timeout — no data for 30s");
          controller.abort();
          setIsStreaming(false);
          onError?.(new Error("Stream stalled — no data received for 30 seconds."));
        }, 30_000);

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            // Skip malformed SSE lines without hiding valid server error events.
            continue;
          }

          if (data.type === "chunk" && data.text) {
            fullText += data.text;
            setStreamedText(fullText);
            onChunk?.(data.text, fullText);
          }

          if (data.type === "done") {
            clearStreamTimeout();
            setIsStreaming(false);
            onDone?.(fullText);
            return fullText;
          }

          if (data.type === "error") {
            throw new Error(data.message || "Stream error");
          }
        }
      }

      // Stream ended without explicit "done" event
      clearStreamTimeout();
      setIsStreaming(false);
      onDone?.(fullText);
      return fullText;
    } catch (err) {
      clearStreamTimeout();
      if (err.name === "AbortError") {
        // User cancelled or timeout fired — not a hard error
        setIsStreaming(false);
        return fullText;
      }

      console.error("[useStreaming] Error:", err instanceof Error ? err.message : "Stream failed");
      setIsStreaming(false);
      onError?.(err);
      throw err;
    }
  }, [abort]);

  return { streamChat, isStreaming, streamedText, abort };
}

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Premium TTS hook using ElevenLabs API via the backend.
 * Sends text to /tts, receives audio buffer, plays via Web Audio API.
 *
 * Returns:
 *   speak(text)  — send text to ElevenLabs and play the audio
 *   stop()       — stop playback immediately
 *   isSpeaking   — true while audio is playing
 *   isLoading    — true while waiting for the API response
 *   error        — error message or null
 */
export default function useElevenLabs() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const abortControllerRef = useRef(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Audio source may already have ended.
      }
      sourceRef.current = null;
    }

    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {
          // AudioContext may already be closed by the browser.
        }
      }
    };
  }, [stop]);

  /**
   * Get or create the AudioContext (lazy init to comply with autoplay policies).
   */
  function getAudioContext() {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }

  /**
   * Speak the given text using ElevenLabs TTS via the backend.
   */
  const speak = useCallback(
    async (text) => {
      if (!text) return;

      // Cancel any current playback
      stop();

      setIsLoading(true);
      setError(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Fetch audio from our backend TTS route
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `TTS request failed: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        setIsLoading(false);

        // Decode and play the audio
        const audioContext = getAudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);

        source.onended = () => {
          setIsSpeaking(false);
          sourceRef.current = null;
        };

        sourceRef.current = source;
        setIsSpeaking(true);
        source.start(0);
      } catch (err) {
        if (err.name === "AbortError") return; // Intentional cancel
        console.error("[useElevenLabs] Error:", err.message);
        setError(err.message);
        setIsLoading(false);
        setIsSpeaking(false);
      }
    },
    [stop]
  );

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
    error,
  };
}

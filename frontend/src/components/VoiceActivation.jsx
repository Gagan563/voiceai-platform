import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ear, Mic2, Radio, VolumeX } from "lucide-react";
import useAppStore from "@/store/appStore";

const wakePhrases = ["hey voxmind", "hey vox", "okay vox", "ok vox", "hey assistant"];

const findCommandAfterWakePhrase = (text) => {
  const normalized = text.toLowerCase().replace(/[,.!?]/g, " ").replace(/\s+/g, " ").trim();

  for (const phrase of wakePhrases) {
    const index = normalized.indexOf(phrase);
    if (index >= 0) {
      return normalized.slice(index + phrase.length).trim();
    }
  }

  return null;
};

export default function VoiceActivation() {
  const enabled = useAppStore((state) => state.settings.voiceActivationEnabled);
  const toggleVoiceActivation = useAppStore((state) => state.toggleVoiceActivation);
  const submitInput = useAppStore((state) => state.submitInput);
  const addMessage = useAppStore((state) => state.addMessage);
  const isLoading = useAppStore((state) => state.isLoading);

  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const startListeningRef = useRef(null);
  const restartTimerRef = useRef(null);
  const awakeTimerRef = useRef(null);
  const enabledRef = useRef(enabled);
  const awaitingCommandRef = useRef(false);
  const isLoadingRef = useRef(isLoading);

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const clearTimers = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (awakeTimerRef.current) clearTimeout(awakeTimerRef.current);
  }, []);

  const disconnectRecognition = useCallback(() => {
    clearTimers();

    try {
      recognitionRef.current?.abort();
    } catch {
      // Browser recognition can already be closed.
    }
    recognitionRef.current = null;
  }, [clearTimers]);

  const stopListening = useCallback(() => {
    disconnectRecognition();
    awaitingCommandRef.current = false;
    setStatus("idle");
    setIsListening(false);
  }, [disconnectRecognition]);

  const submitSpokenCommand = useCallback(
    (command) => {
      const clean = command.trim();
      if (!clean || isLoadingRef.current) return;

      awaitingCommandRef.current = false;
      setStatus("thinking");
      submitInput(clean);
    },
    [submitInput]
  );

  const startListening = useCallback(() => {
    if (!enabledRef.current || recognitionRef.current) return;

    if (!SpeechRecognition) {
      setError("Wake voice needs Chrome or Edge with microphone access.");
      setStatus("error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError("");
      setStatus("listening");
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result.isFinal) continue;

        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        if (awaitingCommandRef.current) {
          submitSpokenCommand(transcript);
          return;
        }

        const command = findCommandAfterWakePhrase(transcript);
        if (command === null) continue;

        if (command) {
          submitSpokenCommand(command);
          return;
        }

        awaitingCommandRef.current = true;
        setStatus("awake");
        addMessage({
          role: "assistant",
          text: "I'm listening.",
          content: "I'm listening.",
          type: "wake_ack",
          timestamp: Date.now(),
        });

        if (awakeTimerRef.current) clearTimeout(awakeTimerRef.current);
        awakeTimerRef.current = setTimeout(() => {
          awaitingCommandRef.current = false;
          if (enabledRef.current) setStatus("listening");
        }, 7000);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission is blocked.");
        setStatus("error");
        return;
      }

      setError(event.error ? `Voice wake error: ${event.error}` : "Voice wake stopped.");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);

      if (!enabledRef.current) {
        setStatus("idle");
        return;
      }

      restartTimerRef.current = setTimeout(() => {
        startListeningRef.current?.();
      }, 450);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setError("Could not start wake listening.");
      setStatus("error");
    }
  }, [SpeechRecognition, addMessage, submitSpokenCommand]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  useEffect(() => {
    queueMicrotask(() => {
      if (enabled) {
        startListening();
      } else {
        stopListening();
      }
    });

    return () => disconnectRecognition();
  }, [disconnectRecognition, enabled, startListening, stopListening]);

  const active = enabled && (isListening || status === "awake");
  const label =
    status === "awake"
      ? "Listening"
      : status === "thinking"
        ? "Thinking"
        : enabled
          ? "Wake on"
          : "Wake off";

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={toggleVoiceActivation}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
          active
            ? "border-aqua/30 bg-aqua/10 text-aqua"
            : "border-line bg-white/[0.04] text-text-muted hover:border-aqua/25 hover:text-text"
        }`}
        aria-pressed={enabled}
        title="Toggle wake voice"
      >
        {status === "error" ? (
          <VolumeX className="h-3.5 w-3.5" />
        ) : status === "awake" ? (
          <Mic2 className="h-3.5 w-3.5" />
        ) : enabled ? (
          <Radio className="h-3.5 w-3.5" />
        ) : (
          <Ear className="h-3.5 w-3.5" />
        )}
        {label}
      </motion.button>

      <AnimatePresence>
        {(status === "awake" || error) && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={`absolute right-0 top-12 z-50 w-64 rounded-2xl border px-4 py-3 text-xs shadow-2xl backdrop-blur-xl ${
              error
                ? "border-danger/25 bg-danger/15 text-danger"
                : "border-aqua/25 bg-ink-950/95 text-text-soft"
            }`}
          >
            {error || 'Say your command now, or say "Hey Vox" followed by the command.'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

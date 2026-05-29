import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, Square } from "lucide-react";
import { useAppStore } from "@/store/appStore";

export const VoiceButton = () => {
  const isRecording = useAppStore((state) => state.isRecording);
  const isLoading = useAppStore((state) => state.isLoading);
  const setRecording = useAppStore((state) => state.setRecording);
  const submitInput = useAppStore((state) => state.submitInput);

  const recognitionRef = useRef(null);
  const silenceTimer = useRef(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const clearSilence = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
  };

  const finalize = () => {
    clearSilence();
    setRecording(false);

    const text = `${finalRef.current} ${interimRef.current}`.trim();
    finalRef.current = "";
    interimRef.current = "";
    setInterim("");
    recognitionRef.current = null;

    if (text) submitInput(text);
  };

  const resetSilence = () => {
    clearSilence();
    silenceTimer.current = setTimeout(() => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition may already be stopped by the browser.
      }
    }, 2000);
  };

  const start = () => {
    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. Please type instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    finalRef.current = "";
    interimRef.current = "";
    setInterim("");
    setError("");

    recognition.onresult = (event) => {
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript;

        if (event.results[index].isFinal) {
          finalRef.current += `${text} `;
        } else {
          interimText += text;
        }
      }

      interimRef.current = interimText;
      setInterim(interimText);
      resetSilence();
    };

    recognition.onerror = (event) => {
      clearSilence();
      setRecording(false);

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access is needed. Please allow it in your browser settings.");
      }
    };

    recognition.onend = () => finalize();

    recognitionRef.current = recognition;
    setRecording(true);

    try {
      recognition.start();
      resetSilence();
    } catch {
      setRecording(false);
      setError("Could not start voice input. Please try again.");
    }
  };

  const handleClick = () => {
    if (isLoading) return;

    if (isRecording) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition may already be stopped by the browser.
      }
    } else {
      start();
    }
  };

  useEffect(() => () => clearSilence(), []);

  const state = isLoading ? "processing" : isRecording ? "recording" : "idle";

  return (
    <div className="relative flex items-center justify-center">
      <AnimatePresence>
        {isRecording ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-[72px] left-1/2 w-max max-w-[60vw] -translate-x-1/2 rounded-2xl border border-vox-border bg-vox-s2 px-4 py-2 text-sm text-vox-text shadow-lg"
            data-testid="voice-live-transcript"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-vox-cancel animate-pulse" />
              {interim || "Listening..."}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {error && !isRecording ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-[72px] left-1/2 w-64 -translate-x-1/2 rounded-2xl border border-vox-cancel/30 bg-vox-cancel/10 px-4 py-2 text-center text-xs text-vox-cancel shadow-lg"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {state === "recording" ? (
        <span className="absolute inset-0 rounded-full animate-glow-pulse" />
      ) : null}

      <motion.button
        type="button"
        onClick={handleClick}
        whileTap={{ scale: 0.92 }}
        animate={{ scale: state === "recording" ? 1.08 : 1 }}
        className={[
          "relative grid h-14 w-14 place-items-center rounded-full outline-none transition-colors duration-300",
          state === "recording"
            ? "bg-vox-primary text-white shadow-[0_0_40px_var(--vox-primary-glow)]"
            : "border border-vox-border bg-vox-s2 text-vox-muted hover:border-vox-primary/50 hover:text-vox-primary",
        ].join(" ")}
        data-testid="voice-record-button"
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {state === "processing" ? (
          <Loader2 size={22} className="animate-spin text-vox-primary" />
        ) : state === "recording" ? (
          <Square size={18} fill="currentColor" />
        ) : (
          <Mic size={22} />
        )}

        {state === "recording" ? (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-vox-cancel ring-2 ring-vox-bg" />
        ) : null}
      </motion.button>
    </div>
  );
};

export default VoiceButton;

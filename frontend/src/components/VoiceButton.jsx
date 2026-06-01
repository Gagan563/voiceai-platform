import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, Square } from "lucide-react";
import useWhisper from "@/hooks/useWhisper";
import { useAppStore } from "@/store/appStore";

export const VoiceButton = () => {
  const isLoading = useAppStore((state) => state.isLoading);
  const setRecording = useAppStore((state) => state.setRecording);
  const submitInput = useAppStore((state) => state.submitInput);
  const {
    isRecording,
    isTranscribing,
    transcript,
    amplitude,
    startRecording,
    stopRecording,
    error,
    isSupported,
  } = useWhisper();
  const lastSubmittedTranscript = useRef("");

  useEffect(() => {
    setRecording(isRecording);
  }, [isRecording, setRecording]);

  useEffect(() => {
    const cleanTranscript = transcript.trim();
    if (
      cleanTranscript &&
      cleanTranscript !== lastSubmittedTranscript.current &&
      !isTranscribing
    ) {
      lastSubmittedTranscript.current = cleanTranscript;
      submitInput(cleanTranscript);
    }
  }, [isTranscribing, submitInput, transcript]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (event.code !== "Space" || isTyping || isLoading) return;

      event.preventDefault();
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLoading, isRecording, startRecording, stopRecording]);

  const state = isLoading || isTranscribing ? "processing" : isRecording ? "recording" : "idle";
  const ringScale = useMemo(() => {
    const normalized = Math.min(Math.max(amplitude / 70, 0), 1);
    return 1.15 + normalized * 0.55;
  }, [amplitude]);

  const handleClick = () => {
    if (isLoading || isTranscribing) return;

    if (isRecording) {
      stopRecording();
      return;
    }

    startRecording();
  };

  const statusText = isTranscribing
    ? "Transcribing..."
    : isRecording
    ? "Listening..."
    : "Hold to speak or press Space";

  return (
    <div className="relative flex items-center justify-center">
      <AnimatePresence>
        {isRecording || isTranscribing ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-[72px] left-1/2 w-max max-w-[68vw] -translate-x-1/2 rounded-2xl border border-vox-border bg-vox-s2 px-4 py-2 text-sm text-vox-text shadow-lg"
            data-testid="voice-live-transcript"
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-vox-cancel animate-pulse" />
              {statusText}
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
            className="absolute bottom-[72px] left-1/2 w-72 -translate-x-1/2 rounded-2xl border border-vox-cancel/30 bg-vox-cancel/10 px-4 py-2 text-center text-xs text-vox-cancel shadow-lg"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {state === "recording" ? (
        <motion.span
          className="absolute inset-0 rounded-full bg-vox-primary/20"
          animate={{ opacity: [0.35, 0.12, 0.35], scale: ringScale }}
          transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      <motion.button
        type="button"
        onClick={handleClick}
        disabled={isLoading || isTranscribing || !isSupported}
        whileTap={{ scale: 0.92 }}
        animate={{ scale: state === "recording" ? 1.08 : 1 }}
        className={[
          "relative grid h-14 w-14 place-items-center rounded-full outline-none transition-colors duration-300",
          state === "recording"
            ? "bg-vox-primary text-white shadow-[0_0_40px_var(--vox-primary-glow)]"
            : "border border-vox-border bg-vox-s2 text-vox-muted hover:border-vox-primary/50 hover:text-vox-primary",
          !isSupported ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
        data-testid="voice-record-button"
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        title={isSupported ? statusText : "MediaRecorder is not supported in this browser"}
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

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import useVoice from "../hooks/useVoice";
import useWhisper from "../hooks/useWhisper";
import useAppStore from "../store/appStore";

export default function VoiceButton() {
  const isLoading = useAppStore((s) => s.isLoading);
  const sttMode = useAppStore((s) => s.sttMode);
  const processUserInput = useAppStore((s) => s.processUserInput);

  // Use the appropriate hook based on STT mode
  const voice = useVoice();
  const whisper = useWhisper();

  const activeHook = sttMode === "whisper" ? whisper : voice;
  const {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    error,
    isSupported,
  } = activeHook;

  const isTranscribing = sttMode === "whisper" ? whisper.isTranscribing : false;

  /**
   * When recording stops and we have a transcript, send it through the intent flow.
   */
  useEffect(() => {
    if (!isRecording && !isTranscribing && transcript && transcript.trim()) {
      processUserInput(transcript.trim());
    }
  }, [isRecording, isTranscribing, processUserInput, transcript]);

  const handleToggle = useCallback(() => {
    if (isLoading || isTranscribing) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, isLoading, isTranscribing, startRecording, stopRecording]);

  const disabled = isLoading || isTranscribing || !isSupported;

  return (
    <div className="relative flex flex-col items-center">
      {/* Live transcript preview — shown above the button while recording */}
      <AnimatePresence>
        {(isRecording || isTranscribing) && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 glass rounded-xl px-3 py-2 z-10"
          >
            {isTranscribing ? (
              <div className="flex items-center gap-2 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-accent-purple)]" />
                <span className="text-xs text-[var(--color-text-muted)]">
                  Transcribing with Whisper...
                </span>
              </div>
            ) : transcript ? (
              <p className="text-xs text-[var(--color-text-primary)] text-center leading-relaxed">
                {transcript}
              </p>
            ) : (
              <div className="flex items-center gap-2 justify-center">
                <div className="dot-loader">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">Listening...</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && !isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-72 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2 z-10 flex items-start gap-2"
          >
            <AlertCircle className="w-3.5 h-3.5 text-[var(--color-accent-red)] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--color-accent-red)] leading-relaxed">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic button */}
      <motion.button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        whileHover={!disabled ? { scale: 1.08 } : {}}
        whileTap={!disabled ? { scale: 0.92 } : {}}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
          isRecording
            ? "bg-[var(--color-accent-red)] text-white shadow-lg shadow-red-500/30"
            : isTranscribing
            ? "bg-[var(--color-accent-purple)]/20 text-[var(--color-accent-purple)]"
            : disabled
            ? "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-accent-purple)] hover:bg-white/[0.06]"
        }`}
        title={
          !isSupported
            ? "Voice input not supported in this browser"
            : isRecording
            ? "Stop recording"
            : isTranscribing
            ? "Transcribing..."
            : `Start recording (${sttMode === "whisper" ? "Whisper" : "Browser STT"})`
        }
      >
        {/* Pulse rings while recording */}
        {isRecording && (
          <>
            <motion.span
              className="absolute inset-0 rounded-xl bg-[var(--color-accent-red)]"
              animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute inset-0 rounded-xl bg-[var(--color-accent-red)]"
              animate={{ scale: [1, 1.8], opacity: [0.2, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
            />
          </>
        )}

        {isTranscribing ? (
          <Loader2 className="w-4.5 h-4.5 animate-spin relative z-10" />
        ) : isRecording ? (
          <MicOff className="w-4.5 h-4.5 relative z-10" />
        ) : (
          <Mic className="w-4.5 h-4.5" />
        )}
      </motion.button>
    </div>
  );
}

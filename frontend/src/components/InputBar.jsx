import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, X, Zap, Globe, Cloud } from "lucide-react";
import { transcribeAudio } from "@/api/client";
import useAppStore from "@/store/appStore";
import VoiceButton from "./VoiceButton";

export default function InputBar() {
  const [input, setInput] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isLoading = useAppStore((s) => s.isLoading);
  const processUserInput = useAppStore((s) => s.processUserInput);
  const sttMode = useAppStore((s) => s.sttMode);
  const toggleSttMode = useAppStore((s) => s.toggleSttMode);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || isTranscribing) return;

    processUserInput(trimmed);
    setInput("");
    setUploadStatus("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleAudioUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsTranscribing(true);
    setUploadStatus(`Transcribing ${file.name}`);

    try {
      const result = await transcribeAudio(file);
      setInput(result.transcript || "");
      setUploadStatus("Transcript ready");
    } catch (err) {
      setUploadStatus(err.message || "Transcription failed");
    } finally {
      setIsTranscribing(false);
      event.target.value = "";
      inputRef.current?.focus();
    }
  };

  const disabled = isLoading || isTranscribing;
  const canSend = input.trim().length > 0 && !disabled;

  return (
    <div className="shrink-0 border-t border-line bg-ink-950/45 px-4 py-4 backdrop-blur-xl sm:px-6">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mx-auto max-w-4xl"
      >
        {uploadStatus ? (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-line bg-panel/70 px-3 py-2 text-xs font-medium text-text-muted">
            <span className="truncate">{uploadStatus}</span>
            <button
              type="button"
              onClick={() => setUploadStatus("")}
              className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-white/[0.06] hover:text-text"
              aria-label="Dismiss status"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <div className="surface flex items-end gap-2 rounded-[1.35rem] p-2 transition focus-within:border-aqua/35 focus-within:shadow-aqua/10">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleAudioUpload}
          />

          {/* Voice Button — replaces the old mic/upload button */}
          <VoiceButton />

          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            placeholder={
              disabled ? "Processing..." : "Type a command for the assistant"
            }
            className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm leading-relaxed text-text outline-none placeholder:text-text-muted disabled:opacity-60"
          />

          <motion.button
            type="submit"
            disabled={!canSend}
            whileHover={canSend ? { scale: 1.03 } : undefined}
            whileTap={canSend ? { scale: 0.97 } : undefined}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
              canSend
                ? "bg-aqua text-ink-950 shadow-lg shadow-aqua/20 hover:bg-text"
                : "border border-line bg-white/[0.04] text-text-muted opacity-70"
            }`}
            title="Send"
            aria-label="Send"
          >
            {isLoading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <Send className="h-4.5 w-4.5" />
            )}
          </motion.button>
        </div>

        {/* STT Mode Toggle + Hint */}
        <div className="mt-2 flex items-center justify-between px-1">
          <motion.button
            type="button"
            onClick={toggleSttMode}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium text-text-muted transition hover:bg-white/[0.05] hover:text-text"
            title="Toggle speech-to-text engine"
          >
            {sttMode === "browser" ? (
              <>
                <Globe className="h-3 w-3 text-emerald-400" />
                <span>Browser STT</span>
                <span className="text-emerald-400">(fast)</span>
              </>
            ) : (
              <>
                <Cloud className="h-3 w-3 text-purple-400" />
                <span>Whisper API</span>
                <span className="text-purple-400">(accurate)</span>
              </>
            )}
          </motion.button>

          <p className="text-[10px] text-text-muted">
            Press{" "}
            <kbd className="rounded bg-white/[0.06] px-1 py-0.5 text-text">
              Enter
            </kbd>{" "}
            to send · Powered by Claude AI
          </p>
        </div>
      </motion.form>
    </div>
  );
}

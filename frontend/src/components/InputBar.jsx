import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Plus } from "lucide-react";
import { VoiceButton } from "@/components/VoiceButton";
import { analyzeContextImage } from "@/api/client";
import { useAppStore } from "@/store/appStore";

export const InputBar = () => {
  const [text, setText] = useState("");
  const [contextBusy, setContextBusy] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const isLoading = useAppStore((state) => state.isLoading);
  const viewingSessionId = useAppStore((state) => state.viewingSessionId);
  const submitInput = useAppStore((state) => state.submitInput);

  const disabled = isLoading || contextBusy || Boolean(viewingSessionId);

  const send = () => {
    if (disabled || !text.trim()) return;

    submitInput(text);
    setText("");
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const handleFile = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";

    if (!file || disabled) return;

    try {
      const content = await file.text();
      submitInput(
        `Requirements file: ${file.name}\n\n${content.slice(0, 12000)}`
      );
    } catch {
      submitInput(
        `Requirements file: ${file.name}\n\nBuild an autonomous AI product from this uploaded requirement.`
      );
    }
  };

  const submitImageContext = async (file, type = "image") => {
    if (!file || disabled) return;

    setContextBusy(true);
    try {
      const result = await analyzeContextImage(
        file,
        type === "screen"
          ? "Summarize this screen and identify what action the user may want next."
          : "Summarize this image for my next voice command.",
        type
      );
      submitInput(
        `${type === "screen" ? "Screen" : "Image"} context from ${file.name}:\n\n${result.analysis}`
      );
    } catch (error) {
      submitInput(
        `${type === "screen" ? "Screen" : "Image"} context upload failed: ${error.message || "unknown error"}`
      );
    } finally {
      setContextBusy(false);
    }
  };

  const handleImage = async (event) => {
    const [file] = Array.from(event.target.files || []);
    event.target.value = "";
    await submitImageContext(file, "image");
  };

  return (
    <div
      className="sticky bottom-0 z-40 w-full bg-gradient-to-t from-[var(--vox-bg)] via-[var(--vox-bg)] to-transparent px-4 pb-4 pt-6 md:px-6"
      data-testid="input-bar"
    >
      <div className="relative mx-auto max-w-3xl">
        <AnimatePresence>
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -top-2 left-0 right-0 h-[3px] overflow-hidden rounded-full bg-[var(--vox-surface-2)]"
              data-testid="input-progress"
            >
              <motion.div
                className="h-full w-1/3 rounded-full bg-brand"
                animate={{ x: ["-120%", "320%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[var(--vox-surface-1)] px-3 py-2 shadow-lg shadow-black/15">
          <VoiceButton />

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.markdown,.json,.csv,.yaml,.yml"
            onChange={handleFile}
          />

          <input
            ref={imageInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleImage}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text-muted transition hover:bg-white/[0.06] hover:text-text disabled:opacity-50"
            aria-label="Upload file"
            title="Upload file"
          >
            <Plus className="h-[18px] w-[18px]" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={
              viewingSessionId ? "Viewing a past conversation..." : "Type a message..."
            }
            className="flex-1 bg-transparent px-2 text-sm text-text outline-none placeholder:text-text-muted disabled:opacity-50"
            data-testid="text-input"
          />

          <button
            type="button"
            onClick={send}
            disabled={disabled || !text.trim()}
            className={[
              "grid h-9 w-9 place-items-center rounded-full transition-all duration-200",
              disabled || !text.trim()
                ? "cursor-not-allowed bg-[var(--vox-surface-2)] text-text-muted"
                : "bg-brand text-ink-950 hover:scale-105 hover:brightness-110",
            ].join(" ")}
            data-testid="send-button"
            aria-label="Send"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputBar;

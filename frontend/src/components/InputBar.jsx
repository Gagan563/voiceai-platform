import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { VoiceButton } from "@/components/VoiceButton";
import { useAppStore } from "@/store/appStore";

export const InputBar = () => {
  const [text, setText] = useState("");
  const isLoading = useAppStore((state) => state.isLoading);
  const viewingSessionId = useAppStore((state) => state.viewingSessionId);
  const submitInput = useAppStore((state) => state.submitInput);

  const disabled = isLoading || Boolean(viewingSessionId);

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

  return (
    <div
      className="sticky bottom-0 z-40 w-full bg-gradient-to-t from-vox-bg via-vox-bg to-transparent px-4 pb-6 pt-10 md:px-6"
      data-testid="input-bar"
    >
      <div className="relative mx-auto max-w-3xl">
        <AnimatePresence>
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -top-2 left-0 right-0 h-[3px] overflow-hidden rounded-full bg-vox-s2"
              data-testid="input-progress"
            >
              <motion.div
                className="h-full w-1/3 rounded-full bg-vox-primary"
                animate={{ x: ["-120%", "320%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex items-center gap-3 rounded-2xl border border-vox-border bg-vox-s1/90 p-3 shadow-2xl backdrop-blur-xl">
          <VoiceButton />

          <input
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            placeholder={
              viewingSessionId ? "Viewing a past conversation..." : "Or type here..."
            }
            className="flex-1 bg-transparent px-2 text-base text-vox-text outline-none placeholder:text-vox-muted disabled:opacity-50"
            data-testid="text-input"
          />

          <button
            type="button"
            onClick={send}
            disabled={disabled || !text.trim()}
            className={[
              "grid h-11 w-11 place-items-center rounded-xl transition-all duration-200",
              disabled || !text.trim()
                ? "cursor-not-allowed bg-vox-s2 text-vox-muted"
                : "bg-vox-primary text-white hover:scale-105 hover:brightness-110",
            ].join(" ")}
            data-testid="send-button"
            aria-label="Send"
          >
            <ArrowUp size={20} />
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-vox-muted">
          VoxMind shows you a plan before anything runs - you stay in control.
        </p>
      </div>
    </div>
  );
};

export default InputBar;

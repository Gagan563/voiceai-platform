import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Mic, Loader2 } from "lucide-react";
import useAppStore from "../store/appStore";

export default function InputBar() {
  const [input, setInput] = useState("");
  const isLoading = useAppStore((s) => s.isLoading);
  const processUserInput = useAppStore((s) => s.processUserInput);
  const inputRef = useRef(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus after loading completes
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    processUserInput(trimmed);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="shrink-0 px-4 pb-4 pt-2">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl flex items-center gap-2 px-4 py-2.5 max-w-3xl mx-auto transition-all duration-300 focus-within:border-[var(--color-accent-purple)]/40 focus-within:shadow-lg focus-within:shadow-purple-500/10"
      >
        {/* Mic button (decorative for now) */}
        <button
          type="button"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent-purple)] hover:bg-white/[0.06] transition-all duration-200"
          title="Voice input (coming soon)"
        >
          <Mic className="w-4.5 h-4.5" />
        </button>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={
            isLoading
              ? "Processing your request..."
              : "Type a message or describe what you need..."
          }
          className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Send button */}
        <motion.button
          type="submit"
          disabled={!input.trim() || isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
            input.trim() && !isLoading
              ? "bg-gradient-to-br from-[var(--color-accent-purple)] to-[var(--color-accent-blue)] text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
              : "text-[var(--color-text-muted)] cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </motion.button>
      </motion.form>

      {/* Subtle hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-[10px] text-[var(--color-text-muted)] mt-2"
      >
        Press <kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-[var(--color-text-secondary)]">Enter</kbd> to
        send · Powered by Claude AI
      </motion.p>
    </div>
  );
}

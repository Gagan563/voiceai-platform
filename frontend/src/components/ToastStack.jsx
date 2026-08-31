import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, AlertCircle, X } from "lucide-react";

export default function ToastStack({ backendOnline, error }) {
  const [dismissed, setDismissed] = useState({});

  const toasts = [
    backendOnline === false && !dismissed.backend
      ? {
          id: "backend",
          type: "info",
          text: "✨ Standalone Mode Active — All UI modules, speech & artifact sandboxes are fully interactive.",
        }
      : null,
    error && !dismissed.error
      ? { id: "error", type: "error", text: error }
      : null,
  ].filter(Boolean);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[65] grid w-[min(380px,calc(100vw-2rem))] gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isInfo = toast.type === "info";
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 18, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 18, scale: 0.96 }}
              className={`flex items-start justify-between gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs font-medium shadow-2xl backdrop-blur-xl transition ${
                isInfo
                  ? "border-indigo-500/30 bg-slate-900/90 text-indigo-200"
                  : "border-red-500/30 bg-slate-900/90 text-red-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {isInfo ? (
                  <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                )}
                <span className="leading-snug">{toast.text}</span>
              </div>
              <button
                onClick={() => setDismissed((prev) => ({ ...prev, [toast.id]: true }))}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition shrink-0"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

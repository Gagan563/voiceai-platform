import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function ToastStack({ backendOnline, error }) {
  const toasts = [
    backendOnline === false
      ? { id: "backend", type: "error", text: "Backend is offline on port 3001." }
      : null,
    error ? { id: "error", type: "error", text: error } : null,
  ].filter(Boolean);

  return (
    <div className="fixed right-4 top-4 z-[65] grid w-[min(360px,calc(100vw-2rem))] gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = toast.type === "error" ? AlertCircle : CheckCircle2;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 18, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 18, scale: 0.96 }}
              className="flex items-start gap-2 rounded-2xl border border-danger/25 bg-danger/15 px-4 py-3 text-xs font-semibold text-danger shadow-2xl shadow-black/30 backdrop-blur-xl"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{toast.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

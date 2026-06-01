import { AnimatePresence, motion } from "framer-motion";
import { Clock3, History, MessageCircle, X } from "lucide-react";
import useAppStore from "@/store/appStore";

export default function HistoryPanel({ isOpen, onClose }) {
  const sessions = useAppStore((state) => state.sessions);
  const viewSession = useAppStore((state) => state.viewSession);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-line bg-ink-950/95 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-aqua/15 text-aqua ring-1 ring-aqua/25">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-text">History</h2>
                  <p className="text-xs text-text-muted">{sessions.length} saved sessions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text"
                aria-label="Close history"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => {
                    viewSession(session.id);
                    onClose();
                  }}
                  className="w-full rounded-2xl border border-line bg-panel/60 p-3 text-left transition hover:border-aqua/30 hover:bg-panel/80"
                >
                  <div className="flex items-start gap-3">
                    <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-aqua" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-text">{session.title}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-text-muted">
                        <Clock3 className="h-3 w-3" />
                        {new Date(session.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

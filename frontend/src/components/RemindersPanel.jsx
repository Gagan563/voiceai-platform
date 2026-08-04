import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";

const panelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
  exit:   { x: "100%", opacity: 0, transition: { duration: 0.2 } },
};

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return "Overdue";
  if (diff < 3600000) return `in ${Math.ceil(diff / 60000)}m`;
  if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ReminderRow({ reminder, onDone }) {
  const [marking, setMarking] = useState(false);

  const handleDone = async () => {
    setMarking(true);
    try {
      await onDone(reminder.id);
    } finally {
      setMarking(false);
    }
  };

  const due = formatTime(reminder.dueAt);
  const isOverdue = due === "Overdue";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.15 } }}
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${
        reminder.done
          ? "border-line bg-white/[0.02] opacity-50"
          : isOverdue
          ? "border-coral/20 bg-coral/[0.06]"
          : "border-line bg-panel/60 hover:border-aqua/15 hover:bg-panel/80"
      }`}
    >
      <button
        type="button"
        onClick={handleDone}
        disabled={marking || reminder.done}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
          reminder.done
            ? "border-leaf/30 bg-leaf text-ink-950"
            : "border-line bg-white/[0.04] text-transparent hover:border-leaf/40 hover:bg-leaf/10"
        }`}
        aria-label={reminder.done ? "Done" : "Mark done"}
      >
        {marking ? (
          <Loader2 className="h-3 w-3 animate-spin text-text-muted" />
        ) : reminder.done ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : null}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${reminder.done ? "line-through text-text-muted" : "text-text"}`}>
          {reminder.text || reminder.content}
        </p>
        {reminder.dueAt && (
          <div className={`mt-1 flex items-center gap-1 text-[11px] ${isOverdue ? "text-coral" : "text-text-muted"}`}>
            <Clock className="h-3 w-3" />
            {due}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function RemindersPanel({ isOpen, onClose }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("pending"); // "pending" | "all"

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get("/reminders");
      setReminders(data.reminders || []);
    } catch (err) {
      setError(err.message || "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) queueMicrotask(fetchReminders);
  }, [isOpen, fetchReminders]);

  const handleDone = async (id) => {
    try {
      await apiClient.patch(`/reminders/${id}`, { done: true });
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, done: true } : r))
      );
    } catch (err) {
      setError(err.message || "Update failed");
    }
  };

  const visible = filter === "all" ? reminders : reminders.filter((r) => !r.done);
  const doneCount = reminders.filter((r) => r.done).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-line bg-ink-950/95 backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber/15 text-amber ring-1 ring-amber/25">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-text">Reminders</h2>
                  <p className="text-xs text-text-muted">
                    {visible.filter((r) => !r.done).length} pending
                    {doneCount > 0 && `, ${doneCount} done`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchReminders}
                  disabled={loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-white/[0.06] hover:text-text"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex border-b border-line px-5 py-2 gap-2">
              {["pending", "all"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                    filter === f
                      ? "bg-aqua/10 text-aqua border border-aqua/20"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {error && (
                <div className="rounded-xl border border-coral/25 bg-coral/10 px-3 py-2 text-xs text-coral">
                  {error}
                </div>
              )}

              {loading && reminders.length === 0 && (
                <div className="flex items-center justify-center py-16 text-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Loading reminders…</span>
                </div>
              )}

              {!loading && visible.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-line mb-4">
                    <Bell className="h-6 w-6 text-text-muted" />
                  </div>
                  <h3 className="text-sm font-semibold text-text">
                    {filter === "pending" ? "All caught up!" : "No reminders yet"}
                  </h3>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-muted">
                    {filter === "pending"
                      ? "No pending reminders. Say \u201cRemind me to\u2026\u201d to add one."
                      : "Say \u201cRemind me to call John at 3pm\u201d to create a reminder."}
                  </p>
                </div>
              )}

              <AnimatePresence mode="popLayout">
                {visible.map((reminder) => (
                  <ReminderRow
                    key={reminder.id}
                    reminder={reminder}
                    onDone={handleDone}
                  />
                ))}
              </AnimatePresence>
            </div>

            <div className="border-t border-line px-5 py-3">
              <p className="text-[10px] leading-relaxed text-text-muted">
                Reminders are created via voice or chat. Say "Remind me to…" with a time or date.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

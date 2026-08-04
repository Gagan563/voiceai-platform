import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";

const panelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
  exit:   { x: "100%", opacity: 0, transition: { duration: 0.2 } },
};

function formatSchedule(schedule) {
  if (!schedule) return "—";
  const m = schedule.match(/^every:(\d+)(m|h)$/);
  if (!m) return schedule;
  const [, n, unit] = m;
  return `Every ${n} ${unit === "m" ? "minute" : "hour"}${Number(n) > 1 ? "s" : ""}`;
}

function formatRelative(date) {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(date).toLocaleDateString();
}

function AgentRow({ agent, onToggle, onRun, running }) {
  const isEnabled = agent.enabled;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="nova-card"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{agent.icon || "🤖"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-text">{agent.name}</span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              isEnabled
                ? "border-leaf/20 bg-leaf/10 text-leaf"
                : "border-line bg-white/[0.03] text-text-muted"
            }`}>
              {isEnabled ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
              {isEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-text-muted">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 shrink-0" />
              {formatSchedule(agent.schedule)}
            </div>
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 shrink-0" />
              Last: {formatRelative(agent.lastRun)}
            </div>
            {agent.runCount !== undefined && (
              <div className="flex items-center gap-1.5">
                <Play className="h-3 w-3 shrink-0" />
                {agent.runCount} run{agent.runCount !== 1 ? "s" : ""}
              </div>
            )}
            {agent.errors > 0 && (
              <div className="flex items-center gap-1.5 text-coral">
                <XCircle className="h-3 w-3 shrink-0" />
                {agent.errors} error{agent.errors !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {agent.permissions?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {agent.permissions.map((p) => (
                <span key={p} className="inline-flex rounded border border-line bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-text-muted">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => onToggle(agent.id)}
            title={isEnabled ? "Disable agent" : "Enable agent"}
            className="text-text-muted transition hover:text-text"
          >
            {isEnabled ? (
              <ToggleRight className="h-6 w-6 text-leaf" />
            ) : (
              <ToggleLeft className="h-6 w-6" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onRun(agent.id)}
            disabled={running === agent.id}
            title="Run now"
            className="nova-btn-sm flex items-center gap-1"
          >
            {running === agent.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Run
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function BackgroundAgentsPanel({ isOpen, onClose }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get("/background-agents");
      setAgents(data.agents || []);
    } catch (err) {
      setError(err.message || "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) queueMicrotask(fetchAgents);
  }, [isOpen, fetchAgents]);

  const handleToggle = async (id) => {
    try {
      const data = await apiClient.patch(`/background-agents/${id}/toggle`);
      setAgents((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled: data.agent?.enabled ?? !a.enabled } : a))
      );
    } catch (err) {
      setError(err.message || "Toggle failed");
    }
  };

  const handleRun = async (id) => {
    setRunning(id);
    try {
      await apiClient.post(`/background-agents/${id}/run`);
      await fetchAgents();
    } catch (err) {
      setError(err.message || "Run failed");
    } finally {
      setRunning(null);
    }
  };

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
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/25">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-text">Background Agents</h2>
                  <p className="text-xs text-text-muted">
                    {agents.filter((a) => a.enabled).length} of {agents.length} active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAgents}
                  disabled={loading}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text transition"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-white/[0.06] hover:text-text transition"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {error && (
                <div className="rounded-xl border border-coral/25 bg-coral/10 px-3 py-2 text-xs text-coral">
                  {error}
                </div>
              )}

              {loading && agents.length === 0 && (
                <div className="flex items-center justify-center py-16 text-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm">Loading agents…</span>
                </div>
              )}

              {!loading && agents.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-line mb-4">
                    <Bot className="h-6 w-6 text-text-muted" />
                  </div>
                  <h3 className="text-sm font-semibold text-text">No background agents</h3>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-muted">
                    Register agents in the backend to have NOVA run automated tasks on a schedule.
                  </p>
                </div>
              )}

              {agents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  onToggle={handleToggle}
                  onRun={handleRun}
                  running={running}
                />
              ))}
            </div>

            <div className="border-t border-line px-5 py-3">
              <p className="text-[10px] leading-relaxed text-text-muted">
                Background agents run on a schedule and emit results via Socket.IO. Results appear as approval cards in the main chat.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

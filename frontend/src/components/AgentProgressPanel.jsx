import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import useAppStore from "@/store/appStore";

const STATUS_META = {
  queued:  { label: "Queued",  color: "text-text-muted",  bg: "bg-white/[0.04]",    border: "border-line" },
  running: { label: "Running", color: "text-amber",       bg: "bg-amber/10",        border: "border-amber/20" },
  done:    { label: "Done",    color: "text-leaf",        bg: "bg-leaf/10",         border: "border-leaf/20" },
  error:   { label: "Error",   color: "text-coral",       bg: "bg-coral/10",        border: "border-coral/20" },
};

function AgentCard({ agent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[agent.status] || STATUS_META.queued;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-xl leading-none">{agent.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text">{agent.name}</span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color} ${meta.border} ${meta.bg}`}>
              {agent.status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {agent.status === "done" && <CheckCircle2 className="h-2.5 w-2.5" />}
              {agent.status === "error" && <XCircle className="h-2.5 w-2.5" />}
              {meta.label}
            </span>
          </div>
          {agent.currentAction && (
            <p className="mt-0.5 text-[11px] text-text-muted truncate">{agent.currentAction}</p>
          )}
        </div>
        {agent.duration && (
          <span className="shrink-0 text-[11px] font-mono text-text-muted">{agent.duration}</span>
        )}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && agent.logs?.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line"
          >
            <div className="max-h-40 overflow-y-auto px-4 py-3 space-y-1.5 font-mono text-[11px]">
              {agent.logs.map((log, i) => (
                <div key={i} className="text-text-muted leading-relaxed">
                  <span className="text-text-muted/50 mr-2 select-none">{String(i + 1).padStart(2, "0")}</span>
                  {log}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AgentProgressPanel({ isOpen, onClose }) {
  const orchestratorRun = useAppStore((s) => s.orchestratorRun);

  const agents = orchestratorRun?.agents ?? [];
  const totalSteps = orchestratorRun?.totalSteps ?? 0;
  const completedSteps = agents.filter((a) => a.status === "done").length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const isRunning = orchestratorRun?.status === "running";

  const panelVariants = {
    hidden: { x: "100%", opacity: 0 },
    visible: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } },
    exit:   { x: "100%", opacity: 0, transition: { duration: 0.2 } },
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
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber/15 text-amber ring-1 ring-amber/25">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-text">Agent Progress</h2>
                  <p className="text-xs text-text-muted">
                    {isRunning ? "Multi-agent DAG running…" : orchestratorRun ? "Completed" : "No active run"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text"
                aria-label="Close"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Progress bar */}
            {orchestratorRun && (
              <div className="border-b border-line px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-text-muted">
                    {completedSteps} / {totalSteps} agents complete
                  </span>
                  <span className="text-xs font-bold text-aqua">{progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-aqua to-violet-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
                {orchestratorRun.duration && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-text-muted">
                    <Clock className="h-3 w-3" />
                    {orchestratorRun.duration}
                  </div>
                )}
              </div>
            )}

            {/* Agent list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-line mb-4">
                    <Zap className="h-6 w-6 text-text-muted" />
                  </div>
                  <h3 className="text-sm font-semibold text-text">No active agents</h3>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-text-muted">
                    When NOVA runs a multi-agent task, each specialist agent will appear here with live progress.
                  </p>
                </div>
              ) : (
                agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-line px-5 py-3">
              <p className="text-[10px] leading-relaxed text-text-muted">
                NOVA uses a DAG-based multi-agent engine: Coder 🔧, Researcher 🔍, Analyst 📊, Designer 🎨, and Tester 🧪 run in parallel based on dependencies.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

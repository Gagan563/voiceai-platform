import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Pencil,
  XCircle,
  Clock,
  Zap,
  Server,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import useAppStore from "../store/appStore";

/** Map service names to colors */
const serviceColors = {
  calendar: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  email: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  database: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  ai: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  notification: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  device: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  filesystem: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  web: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
};

/** Single step card */
function StepCard({ step, index }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = serviceColors[step.service] || serviceColors.ai;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 300, damping: 25 }}
      className="glass rounded-xl overflow-hidden hover:border-[var(--color-accent-purple)]/30 transition-all duration-300 group"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Step number */}
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-accent-purple)]/20 to-[var(--color-accent-blue)]/20 flex items-center justify-center shrink-0 border border-[var(--color-accent-purple)]/20">
          <span className="text-xs font-bold text-[var(--color-accent-purple)]">
            {step.step}
          </span>
        </div>

        {/* Action & description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {step.action?.replace(/_/g, " ")}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${colorClass}`}>
              {step.service}
            </span>
          </div>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1 text-[var(--color-text-muted)] shrink-0">
          <Clock className="w-3 h-3" />
          <span className="text-[10px]">{step.estimated_duration_seconds}s</span>
        </div>

        {/* Expand icon */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0 space-y-2 border-t border-white/[0.04]">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed pt-2">
                {step.description}
              </p>
              {step.requires_input && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Zap className="w-3 h-3" />
                  <span className="text-[10px] font-medium">Requires your input</span>
                </div>
              )}
              {step.fallback && (
                <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                  <Server className="w-3 h-3" />
                  <span className="text-[10px]">Fallback: {step.fallback}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PlanCards() {
  const currentPlan = useAppStore((s) => s.currentPlan);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingStage = useAppStore((s) => s.loadingStage);
  const approvePlan = useAppStore((s) => s.approvePlan);
  const cancelPlan = useAppStore((s) => s.cancelPlan);

  if (!currentPlan || currentPlan.length === 0) return null;

  const totalDuration = currentPlan.reduce(
    (sum, step) => sum + (step.estimated_duration_seconds || 0),
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="shrink-0 px-4 pb-2"
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--color-accent-purple)]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Execution Plan
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {currentPlan.length} steps · ~{totalDuration}s
            </span>
          </div>
        </div>

        {/* Step cards */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-3">
          {currentPlan.map((step, i) => (
            <StepCard key={step.step || i} step={step} index={i} />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={cancelPlan}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--color-accent-red)] bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={approvePlan}
            disabled={isLoading}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[var(--color-accent-green)] to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && loadingStage === "execute" ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <Clock className="w-3.5 h-3.5" />
                </motion.div>
                Executing...
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Approve & Execute
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

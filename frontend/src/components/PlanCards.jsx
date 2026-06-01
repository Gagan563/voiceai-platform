import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Brain,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  FileText,
  Globe2,
  HardDrive,
  Mail,
  MonitorCog,
  Play,
  Server,
  XCircle,
} from "lucide-react";
import useAppStore from "@/store/appStore";

const serviceMeta = {
  calendar: {
    icon: CalendarDays,
    className: "border-aqua/25 bg-aqua/10 text-aqua",
  },
  email: { icon: Mail, className: "border-coral/25 bg-coral/10 text-coral" },
  database: {
    icon: Database,
    className: "border-leaf/25 bg-leaf/10 text-leaf",
  },
  ai: { icon: Brain, className: "border-brand/25 bg-brand/10 text-brand" },
  notification: {
    icon: Bell,
    className: "border-amber/25 bg-amber/10 text-amber",
  },
  device: {
    icon: MonitorCog,
    className: "border-coral/25 bg-coral/10 text-coral",
  },
  filesystem: {
    icon: HardDrive,
    className: "border-aqua/25 bg-aqua/10 text-aqua",
  },
  web: { icon: Globe2, className: "border-brand/25 bg-brand/10 text-brand" },
};

function StepCard({ step, index, selected, onToggle }) {
  const [expanded, setExpanded] = useState(index === 0);
  const meta = serviceMeta[step.service] || {
    icon: FileText,
    className: "border-line bg-white/[0.04] text-text-soft",
  };
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 320, damping: 26 }}
      className="overflow-hidden rounded-2xl border border-line bg-white/[0.035]"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left"
      >
        <span
          role="checkbox"
          aria-checked={selected}
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(step.id);
          }}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              onToggle(step.id);
            }
          }}
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs transition ${
            selected
              ? "border-leaf/30 bg-leaf text-ink-950"
              : "border-line bg-white/[0.04] text-text-muted"
          }`}
        >
          {selected ? <Check className="h-3.5 w-3.5" /> : null}
        </span>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-ink-950/45 font-code text-xs font-semibold text-text-soft">
          {step.step || index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-text">
              {(step.action || "action").replace(/_/g, " ")}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-text-muted">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${meta.className}`}
            >
              <Icon className="h-3 w-3" />
              {step.service || "service"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" />
              {step.estimated_duration_seconds || 0}s
            </span>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-line px-3 pb-3 pt-3">
              <p className="text-xs leading-relaxed text-text-soft">
                {step.description}
              </p>

              {step.requires_input ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-amber/25 bg-amber/10 px-2 py-1 text-[11px] font-semibold text-amber">
                  <Bell className="h-3 w-3" />
                  Needs input
                </div>
              ) : null}

              {step.fallback ? (
                <div className="flex items-start gap-2 rounded-xl border border-line bg-ink-950/35 p-2 text-[11px] leading-relaxed text-text-muted">
                  <Server className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-soft" />
                  <span>{step.fallback}</span>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
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
  const planKey = (currentPlan || []).map((step) => step.id).join("|");
  const [selection, setSelection] = useState(() => ({
    planKey: "",
    ids: new Set(),
  }));

  const selectedIds =
    selection.planKey === planKey
      ? selection.ids
      : new Set((currentPlan || []).map((step) => step.id));

  if (!currentPlan?.length) return null;

  const toggleStep = (id) => {
    setSelection((current) => {
      const base =
        current.planKey === planKey
          ? current.ids
          : new Set((currentPlan || []).map((step) => step.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { planKey, ids: next };
    });
  };

  const selectedCount = selectedIds.size;
  const selectedDuration = currentPlan
    .filter((step) => selectedIds.has(step.id))
    .reduce((sum, step) => sum + (step.estimated_duration_seconds || 0), 0);

  const totalDuration = currentPlan.reduce(
    (sum, step) => sum + (step.estimated_duration_seconds || 0),
    0
  );
  const executing = isLoading && loadingStage === "execute";

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      className="fixed inset-x-3 bottom-28 z-30 max-h-[58vh] overflow-hidden rounded-[1.5rem] border border-line bg-panel/95 shadow-2xl shadow-black/35 backdrop-blur-2xl xl:static xl:z-auto xl:max-h-none xl:rounded-none xl:border-y-0 xl:border-r-0 xl:bg-ink-950/35 xl:shadow-none"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-line px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber/15 text-amber ring-1 ring-amber/25">
                  <Play className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-semibold text-text">
                    Execution plan
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-text-muted">
                    {selectedCount}/{currentPlan.length} selected, about {selectedDuration || totalDuration}s
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={cancelPlan}
              disabled={isLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white/[0.04] text-text-muted transition hover:border-danger/30 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
              aria-label="Cancel plan"
              title="Cancel plan"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {currentPlan.map((step, index) => (
            <StepCard
              key={step.id || `${step.step || index}-${step.action}`}
              step={step}
              index={index}
              selected={selectedIds.has(step.id)}
              onToggle={toggleStep}
            />
          ))}
        </div>

        <div className="shrink-0 border-t border-line p-3">
          <div className="grid grid-cols-[1fr_1.45fr] gap-2">
            <button
              type="button"
              onClick={cancelPlan}
              disabled={isLoading}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-white/[0.04] text-xs font-semibold text-text-soft transition hover:border-danger/30 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>

            <motion.button
              type="button"
              onClick={() => approvePlan([...selectedIds])}
              disabled={isLoading || selectedCount === 0}
              whileHover={!isLoading ? { scale: 1.02 } : undefined}
              whileTap={!isLoading ? { scale: 0.98 } : undefined}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-leaf px-3 text-xs font-bold text-ink-950 shadow-lg shadow-leaf/15 transition hover:bg-text disabled:opacity-60"
            >
              {executing ? (
                <>
                  <Clock3 className="h-4 w-4 animate-spin" />
                  Executing
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve selected
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

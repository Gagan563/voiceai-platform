import {
  Boxes,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Code2,
  Globe,
  Laptop,
  ListChecks,
  Mic,
  Smartphone,
  Sparkles,
  Sprout,
} from "lucide-react";
import SlidePanel from "@/components/SlidePanel";

const phases = [
  {
    phase: "Phase 1",
    title: "Core pipeline",
    status: "done",
    icon: ListChecks,
    remaining: "Harden plan editing tests and add more backend route coverage.",
  },
  {
    phase: "Phase 2",
    title: "Voice input and output",
    status: "done",
    icon: Mic,
    remaining: "Cross-browser voice QA and better permission fallback copy.",
  },
  {
    phase: "Phase 3",
    title: "Memory system",
    status: "partial",
    icon: Sparkles,
    remaining: "Finish duplicate detection, vector index verification, and memory builder agent.",
  },
  {
    phase: "Phase 4",
    title: "Core modules",
    status: "partial",
    icon: Boxes,
    remaining: "Complete database-backed tasks, write editor, real search, and health flows.",
  },
  {
    phase: "Phase 5",
    title: "One-command builder",
    status: "partial",
    icon: Code2,
    remaining: "Add guarded terminal/browser tools, project templates, and installable app output.",
  },
  {
    phase: "Phase 6",
    title: "Advanced memory",
    status: "partial",
    icon: CircleDashed,
    remaining: "Connect session summaries, fact review controls, and memory privacy export.",
  },
  {
    phase: "Phase 7",
    title: "Desktop packaging",
    status: "partial",
    icon: Laptop,
    remaining: "Run Forge packaging on each OS, sign installers, and test tray/hotkey behavior.",
  },
  {
    phase: "Phase 8",
    title: "Unique modules",
    status: "pending",
    icon: Sprout,
    remaining: "Build Farm, Legal, Wellness, and Emergency modules with offline data.",
  },
  {
    phase: "Phase 9",
    title: "Mobile app",
    status: "pending",
    icon: Smartphone,
    remaining: "Finish React Native voice, secure storage, notifications, widgets, and release builds.",
  },
  {
    phase: "Phase 10",
    title: "Global launch",
    status: "pending",
    icon: Globe,
    remaining: "Add i18n, accessibility modes, CI releases, docs, and launch checklist.",
  },
];

const statusMeta = {
  done: {
    label: "Built",
    className: "border-leaf/25 bg-leaf/10 text-leaf",
    icon: CheckCircle2,
  },
  partial: {
    label: "In progress",
    className: "border-amber/25 bg-amber/10 text-amber",
    icon: Clock3,
  },
  pending: {
    label: "Remaining",
    className: "border-text-muted/20 bg-white/[0.035] text-text-muted",
    icon: CircleDashed,
  },
};

export default function RequirementsPanel({ isOpen, onClose }) {
  const counts = phases.reduce(
    (acc, phase) => ({ ...acc, [phase.status]: (acc[phase.status] || 0) + 1 }),
    {}
  );

  return (
    <SlidePanel
      open={isOpen}
      side="right"
      onClose={onClose}
      title="Remaining Work"
      subtitle="Roadmap from the pasted NOVA build phases"
      testid="requirements-panel"
      footer={
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Built", counts.done || 0, "text-leaf"],
            ["Progress", counts.partial || 0, "text-amber"],
            ["Left", counts.pending || 0, "text-text-muted"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-xl border border-line bg-white/[0.035] px-3 py-2">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
                {label}
              </p>
            </div>
          ))}
        </div>
      }
    >
      <div className="space-y-3">
        {phases.map((phase) => {
          const Icon = phase.icon;
          const StatusIcon = statusMeta[phase.status].icon;

          return (
            <article
              key={phase.phase}
              className="rounded-2xl border border-line bg-white/[0.035] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                      {phase.phase}
                    </p>
                    <span
                      className={`inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] font-bold ${statusMeta[phase.status].className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusMeta[phase.status].label}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-text">{phase.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    {phase.remaining}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SlidePanel>
  );
}

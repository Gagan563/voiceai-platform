import { motion } from "framer-motion";
import {
  Activity,
  Boxes,
  Bug,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileText,
  GitBranch,
  GitPullRequest,
  Layers3,
  MonitorPlay,
  Network,
  Route,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import useAppStore from "@/store/appStore";

const devAgentModules = [
  {
    title: "Codebase Brain",
    icon: Code2,
    status: "Ready",
    detail: "Index files, explain architecture, find symbols, and answer repo questions.",
  },
  {
    title: "Builder",
    icon: Workflow,
    status: "Planned",
    detail: "Turn specs into scoped tasks, edit files, refactor, and generate migrations.",
  },
  {
    title: "Terminal Runner",
    icon: Terminal,
    status: "Guarded",
    detail: "Run installs, tests, builds, scripts, and capture command evidence.",
  },
  {
    title: "Test Doctor",
    icon: Bug,
    status: "Ready",
    detail: "Write tests, debug failures, summarize CI, and propose fixes.",
  },
  {
    title: "Browser Preview",
    icon: MonitorPlay,
    status: "Ready",
    detail: "Open the app, inspect screenshots, catch UI issues, and iterate.",
  },
  {
    title: "PR Reviewer",
    icon: GitPullRequest,
    status: "Planned",
    detail: "Review diffs for bugs, risks, regressions, and missing tests.",
  },
  {
    title: "Worktrees",
    icon: GitBranch,
    status: "Planned",
    detail: "Run parallel agents on isolated branches for larger jobs.",
  },
  {
    title: "Subagents",
    icon: Network,
    status: "Planned",
    detail: "Split research, coding, review, and QA into coordinated specialists.",
  },
];

const defaultPreview = {
  title: "AI Product Preview",
  status: "idle",
  source: "Waiting",
  summary:
    "Upload a requirement file, speak, or type a command to generate a product and developer-agent preview.",
  features: [
    "File, voice, and text intake",
    "Codebase agent workspace",
    "Terminal and test runner",
    "Pull request reviewer",
    "Browser preview loop",
    "Intent classifier",
    "Planner board",
    "Execution queue",
  ],
  workflow: [
    "Capture requirement",
    "Extract intent",
    "Design execution plan",
    "Preview result",
  ],
  screens: [
    "Command center",
    "Planner board",
    "Code workspace",
    "Review queue",
    "Live preview",
  ],
  automation: [
    "analyze requirements",
    "generate preview",
    "run tests",
    "review diffs",
    "validate workflow",
  ],
  stack: ["React", "Node API", "Agent planner", "Voice I/O", "Git tools"],
};

const statusMeta = {
  idle: {
    label: "Standby",
    icon: MonitorPlay,
    className: "border-line bg-white/[0.04] text-text-muted",
  },
  planned: {
    label: "Planned",
    icon: ClipboardList,
    className: "border-amber/25 bg-amber/10 text-amber",
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    className: "border-leaf/25 bg-leaf/10 text-leaf",
  },
};

function Pill({ children }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-line bg-white/[0.04] px-2.5 text-[11px] font-semibold text-text-soft">
      {children}
    </span>
  );
}

function PreviewList({ title, icon: Icon, items }) {
  return (
    <div className="border-t border-line px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-aqua" />
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
          {title}
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Pill key={item}>{item}</Pill>
        ))}
      </div>
    </div>
  );
}

function DevAgentSuite() {
  return (
    <div className="border-t border-line px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-amber" />
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
          Dev Agent Suite
        </h3>
      </div>

      <div className="grid gap-2">
        {devAgentModules.map((module) => {
          const Icon = module.icon;

          return (
            <div
              key={module.title}
              className="rounded-xl border border-line bg-ink-950/35 p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.04] text-aqua">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-bold text-text">
                      {module.title}
                    </p>
                    <span className="rounded-full border border-line bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                      {module.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                    {module.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PreviewPanel() {
  const artifact = useAppStore((s) => s.previewArtifact) || defaultPreview;
  const status = statusMeta[artifact.status] || statusMeta.idle;
  const StatusIcon = status.icon;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      className="hidden min-h-0 border-l border-line bg-ink-950/35 xl:flex xl:flex-col"
    >
      <div className="shrink-0 border-b border-line px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-aqua/15 text-aqua ring-1 ring-aqua/25">
                <MonitorPlay className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-display text-sm font-semibold text-text">
                  Live preview
                </h2>
                <p className="mt-0.5 text-xs font-medium text-text-muted">
                  {artifact.source}
                </p>
              </div>
            </div>
          </div>
          <span
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${status.className}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {status.label}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          <div className="overflow-hidden rounded-2xl border border-line bg-white/[0.035]">
            <div className="border-b border-line bg-panel/70 p-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
                <Sparkles className="h-3.5 w-3.5" />
                Generated product
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold leading-tight text-text">
                {artifact.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-text-soft">
                {artifact.summary}
              </p>
            </div>

            <div className="grid grid-cols-3 border-b border-line text-center">
              <div className="border-r border-line px-2 py-3">
                <p className="font-code text-lg font-semibold text-text">
                  {artifact.features.length}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Modules
                </p>
              </div>
              <div className="border-r border-line px-2 py-3">
                <p className="font-code text-lg font-semibold text-text">
                  {artifact.screens.length}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Views
                </p>
              </div>
              <div className="px-2 py-3">
                <p className="font-code text-lg font-semibold text-text">
                  {artifact.automation.length}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Jobs
                </p>
              </div>
            </div>

            <PreviewList title="Capabilities" icon={Boxes} items={artifact.features} />
            {artifact.previewUrl ? (
              <div className="border-t border-line px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <MonitorPlay className="h-4 w-4 text-leaf" />
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                    Running Preview
                  </h3>
                </div>
                <div className="overflow-hidden rounded-xl border border-line bg-white">
                  <iframe
                    title={artifact.title}
                    src={artifact.previewUrl}
                    className="h-72 w-full bg-white"
                    sandbox="allow-scripts allow-forms allow-same-origin"
                  />
                </div>
                {artifact.agentSummary ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                    {artifact.agentSummary}
                  </p>
                ) : null}
              </div>
            ) : null}
            <PreviewList title="Workflow" icon={Route} items={artifact.workflow} />
            <PreviewList title="Screens" icon={Layers3} items={artifact.screens} />
            <PreviewList title="Autonomous Jobs" icon={Activity} items={artifact.automation} />
            <DevAgentSuite />
            <PreviewList title="Stack" icon={FileText} items={artifact.stack} />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-line px-4 py-3">
        <div className="flex items-center gap-2 rounded-2xl border border-leaf/20 bg-leaf/10 px-3 py-2 text-xs font-semibold text-leaf">
          <ShieldCheck className="h-4 w-4" />
          Risky real-world actions stay behind policy checks.
        </div>
      </div>
    </motion.aside>
  );
}

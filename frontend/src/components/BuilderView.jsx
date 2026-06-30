import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  ClipboardList,
  Code2,
  Copy,
  Eye,
  Expand,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Upload,
  XCircle,
} from "lucide-react";
import { VoiceButton } from "@/components/VoiceButton";
import { analyzeContextImage } from "@/api/client";
import useAppStore from "@/store/appStore";
import useTTS from "@/hooks/useTTS";
import useElevenLabs from "@/hooks/useElevenLabs";
import PlanCards from "@/components/PlanCards";
import SpeakingIndicator from "@/components/SpeakingIndicator";

/* ── Tips shown while generating ── */
const generatingTips = [
  {
    title: "Add Voice Commands",
    description: "Let users control the app hands-free with natural language voice input powered by NOVA.",
    gradient: "from-cyan-600 to-teal-500",
  },
  {
    title: "Connect Your Data",
    description: "Pull in real-time data from APIs, databases, or uploaded files to power dynamic features.",
    gradient: "from-violet-600 to-indigo-500",
  },
  {
    title: "Deploy in One Click",
    description: "Push your project live instantly with NOVA's built-in deployment pipeline.",
    gradient: "from-emerald-600 to-cyan-500",
  },
];

/* ── Execution review card ── */
function ExecutionReview({ review, batches = [] }) {
  if (!review) return null;
  const confidence = Number.isFinite(Number(review.confidence))
    ? Math.round(Number(review.confidence) * 100)
    : null;

  return (
    <div className="nova-card mt-3 rounded-lg p-3">
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-leaf" />
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">
          Self review
        </span>
        {confidence !== null && (
          <span className="font-code text-[11px] text-text-muted">{confidence}%</span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-text-soft">{review.summary}</p>
      {review.issues?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {review.issues.slice(0, 3).map((issue) => (
            <span key={issue} className="rounded-lg border border-amber/25 bg-amber/10 px-2 py-1 text-[11px] font-medium text-amber">
              {issue}
            </span>
          ))}
        </div>
      )}
      {batches.length > 0 && (
        <div className="mt-2 text-[11px] font-medium text-text-muted">
          {batches.filter((b) => b.mode === "parallel").length} parallel batch(es)
        </div>
      )}
    </div>
  );
}

/* ── Message bubble (rich) ── */
function MessageBubble({ msg, speakingId, onStopSpeaking }) {
  const isUser = msg.role === "user";

  if (msg.role === "system" || msg.type === "error") {
    return (
      <div className="flex items-start gap-2 px-3 py-1.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
        <p className="text-xs leading-relaxed text-coral">{msg.content}</p>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="rounded-lg bg-[var(--vox-surface-2)] px-3 py-2.5">
        <p className="text-sm leading-relaxed text-text">{msg.content}</p>
        <span className="mt-1 block text-right font-code text-[10px] text-text-muted">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  /* Assistant messages */
  const iconMap = {
    intent: <Brain className="h-3.5 w-3.5" />,
    plan_intro: <ClipboardList className="h-3.5 w-3.5" />,
    execution_confirmation: <CheckCircle2 className="h-3.5 w-3.5 text-leaf" />,
    plan_cancelled: <XCircle className="h-3.5 w-3.5" />,
    approval_required: <Bot className="h-3.5 w-3.5 text-amber" />,
    autopilot: <Bot className="h-3.5 w-3.5 text-leaf" />,
  };

  const msgIcon = iconMap[msg.type] || (
    <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
      <path d="M16 8L22 14L16 20L10 14L16 8Z" fill="currentColor" fillOpacity="0.8" />
      <path d="M16 12L20 16L16 20L12 16L16 12Z" fill="currentColor" />
    </svg>
  );

  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <span className="mt-0.5 text-aqua">{msgIcon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-text-soft">{msg.content}</p>

        {msg.type === "execution_confirmation" && msg.execution?.review && (
          <ExecutionReview review={msg.execution.review} batches={msg.execution.batches || []} />
        )}

        <span className="mt-1 block font-code text-[10px] text-text-muted">
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>

        {speakingId === msg.id && (
          <div className="mt-1">
            <SpeakingIndicator onStop={onStopSpeaking} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step indicator ── */
function StepIndicator({ plan, loadingStage }) {
  if (!plan?.length && !loadingStage) return null;

  const stageLabels = {
    intent: "Understanding request",
    plan: "Building execution plan",
    execute: "Running plan steps",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <svg width="12" height="12" viewBox="0 0 32 32" fill="none" className="text-aqua">
        <path d="M16 8L22 14L16 20L10 14L16 8Z" fill="currentColor" fillOpacity="0.8" />
        <path d="M16 12L20 16L16 20L12 16L16 12Z" fill="currentColor" />
      </svg>
      <span className="text-xs font-medium text-aqua">
        {loadingStage ? stageLabels[loadingStage] || "Processing" : "Ready"}
      </span>
    </div>
  );
}

/* ── Preview panel ── */
function PreviewPanel({ previewArtifact, isLoading }) {
  const [activeTab, setActiveTab] = useState("preview");
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) return;
    const iv = setInterval(() => setTipIndex((i) => (i + 1) % generatingTips.length), 5000);
    return () => clearInterval(iv);
  }, [isLoading]);

  const previewUrl = previewArtifact?.previewUrl || previewArtifact?.previewFile;
  const hasPreview = Boolean(previewUrl);
  const tip = generatingTips[tipIndex];

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "preview" ? "bg-aqua/10 text-aqua" : "text-text-muted hover:text-text"
            }`}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "code" ? "bg-aqua/10 text-aqua" : "text-text-muted hover:text-text"
            }`}
          >
            <Code2 className="h-3 w-3" />
            Code
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {hasPreview && (
            <button
              type="button"
              onClick={() => window.open(previewUrl, "_blank")}
              className="grid h-7 w-7 place-items-center rounded text-text-muted transition hover:bg-white/[0.06] hover:text-text"
              title="Open in new tab"
            >
              <Expand className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === "preview" ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
            {isLoading ? (
              /* ── Generating state ── */
              <div className="flex w-full max-w-2xl flex-col items-center px-6 py-8">
                <p className="mb-1 text-xs text-aqua/70">NOVA is building</p>
                <p className="mb-8 text-base font-semibold text-text">Tips while your project takes shape</p>
                <div className="flex w-full items-start gap-4">
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[var(--vox-surface-1)] py-20">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-aqua" style={{ animationDelay: "0ms" }} />
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                  <div className="w-[240px] shrink-0 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)]">
                    <div className={`h-28 bg-gradient-to-br ${tip.gradient} flex items-center justify-center`}>
                      <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2 backdrop-blur">
                        <Plus className="h-4 w-4 text-white" />
                        <div className="space-y-1">
                          <div className="h-1.5 w-16 rounded bg-white/60" />
                          <div className="h-1.5 w-12 rounded bg-white/40" />
                          <div className="h-1.5 w-20 rounded bg-white/50" />
                        </div>
                      </div>
                    </div>
                    <div className="bg-[var(--vox-surface-1)] p-3">
                      <p className="text-sm font-semibold text-text">{tip.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-text-muted">{tip.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : hasPreview ? (
              <iframe src={previewUrl} title="App Preview" className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin allow-forms" />
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                  <Eye className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-text">Preview</p>
                <p className="max-w-sm text-xs leading-relaxed text-text-muted">
                  {previewArtifact
                    ? previewArtifact.summary || "Your app has been built. Check the output files."
                    : "Describe what you want to build and the preview will appear here."}
                </p>
                {previewArtifact?.features?.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {previewArtifact.features.slice(0, 6).map((f) => (
                      <span key={f} className="rounded-md border border-[rgba(255,255,255,0.06)] bg-[var(--vox-surface-1)] px-2 py-1 text-[11px] text-text-muted">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── Code tab ── */
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
            {previewArtifact ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text">{previewArtifact.title || "Generated Output"}</h3>
                  <button type="button" className="inline-flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[11px] text-text-muted transition hover:text-text">
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                {previewArtifact.stack?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {previewArtifact.stack.map((s) => (
                      <span key={s} className="rounded border border-brand/20 bg-brand/8 px-2 py-0.5 text-[11px] font-medium text-brand">{s}</span>
                    ))}
                  </div>
                )}
                {previewArtifact.automation?.length > 0 && (
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[var(--vox-surface-1)] p-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">Execution steps</p>
                    <div className="space-y-1.5">
                      {previewArtifact.automation.map((step, i) => (
                        <div key={step} className="flex items-center gap-2 text-xs text-text-soft">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--vox-surface-2)] font-mono text-[10px] text-text-muted">{i + 1}</span>
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {previewArtifact.agentSummary && (
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[var(--vox-surface-1)] p-3">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">Agent output</p>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-soft">{previewArtifact.agentSummary}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <Code2 className="mb-3 h-8 w-8 text-text-muted" />
                <p className="text-sm text-text-muted">Code output will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   BuilderView — main split layout
   ═══════════════════════════════════════════ */
export default function BuilderView({ onBack, onOpenPanel }) {
  const [chatText, setChatText] = useState("");
  const [contextBusy, setContextBusy] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const scrollRef = useRef(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const messages = useAppStore((s) => s.messages);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingStage = useAppStore((s) => s.loadingStage);
  const currentPlan = useAppStore((s) => s.currentPlan);
  const previewArtifact = useAppStore((s) => s.previewArtifact);
  const submitInput = useAppStore((s) => s.submitInput);
  const settings = useAppStore((s) => s.settings);
  const speakingId = useAppStore((s) => s.speakingId);
  const setSpeakingMessageId = useAppStore((s) => s.setSpeakingMessageId);
  const lastIntent = useAppStore((s) => s.lastIntent);

  const browserTTS = useTTS();
  const elevenLabsTTS = useElevenLabs();
  const activeTTS = settings.ttsMode === "elevenlabs" ? elevenLabsTTS : browserTTS;
  const prevCount = useRef(messages.length);

  const disabled = isLoading || contextBusy;

  /* Auto-scroll chat */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, currentPlan]);

  /* Timer while loading */
  useEffect(() => {
    if (!isLoading) return;
    const iv = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => {
      clearInterval(iv);
      setElapsedSeconds(0);
    };
  }, [isLoading]);

  /* Auto-speak */
  useEffect(() => {
    if (!settings.ttsEnabled) return;
    if (messages.length <= prevCount.current) { prevCount.current = messages.length; return; }
    prevCount.current = messages.length;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.type !== "intent" && last.content) {
      setSpeakingMessageId(last.id);
      activeTTS.speak(last.content);
    }
  }, [activeTTS, messages, setSpeakingMessageId, settings.ttsEnabled]);

  useEffect(() => {
    if (!activeTTS.isSpeaking && speakingId) setSpeakingMessageId(null);
  }, [activeTTS.isSpeaking, setSpeakingMessageId, speakingId]);

  const handleStopSpeaking = () => {
    activeTTS.stop();
    setSpeakingMessageId(null);
  };

  const send = () => {
    if (disabled || !chatText.trim()) return;
    submitInput(chatText);
    setChatText("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleFile = async (e) => {
    const [file] = Array.from(e.target.files || []);
    e.target.value = "";
    if (!file || disabled) return;
    try {
      const content = await file.text();
      submitInput(`Requirements file: ${file.name}\n\n${content.slice(0, 12000)}`);
    } catch {
      submitInput(`Requirements file: ${file.name}\n\nBuild an autonomous AI product from this uploaded requirement.`);
    }
  };

  const handleImage = async (e) => {
    const [file] = Array.from(e.target.files || []);
    e.target.value = "";
    if (!file || disabled) return;
    setContextBusy(true);
    try {
      const result = await analyzeContextImage(file, "Summarize this image.", "image");
      submitInput(`Image context: ${result.analysis}`);
    } catch (err) {
      submitInput(`Image upload failed: ${err.message || "unknown"}`);
    } finally {
      setContextBusy(false);
    }
  };

  /* Derive title from first user message */
  const firstUser = messages.find((m) => m.role === "user");
  const projectTitle = lastIntent?.goal
    ? lastIntent.goal.split(" ").slice(0, 6).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : firstUser?.content?.slice(0, 40) || "Untitled";

  return (
    <div className="flex h-full flex-col bg-[var(--vox-bg)]">
      {/* ── Top bar ── */}
      <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-[var(--vox-border)] bg-[var(--vox-sidebar)] px-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted transition hover:bg-aqua/8 hover:text-aqua"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New project
        </button>

        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none" className="text-aqua">
            <path d="M16 8L22 14L16 20L10 14L16 8Z" fill="currentColor" fillOpacity="0.8" />
            <path d="M16 12L20 16L16 20L12 16L16 12Z" fill="currentColor" />
          </svg>
          <span className="text-sm font-semibold text-text">{projectTitle}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Panel access buttons (since sidebar is hidden) */}
          {onOpenPanel && (
            <>
              <button type="button" onClick={() => onOpenPanel("memory")} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text" title="Memory">
                <Search className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onOpenPanel("history")} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text" title="History">
                <BookOpen className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onOpenPanel("routines")} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text" title="Routines">
                <Layers3 className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onOpenPanel("settings")} className="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text" title="Settings">
                <Settings className="h-3.5 w-3.5" />
              </button>
              <div className="mx-1 h-5 w-px bg-[var(--vox-border)]" />
            </>
          )}
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--vox-border)] bg-[var(--vox-surface-1)] px-3 py-1.5 text-xs font-medium text-text-muted transition hover:text-text">
            <RefreshCw className="h-3 w-3" />
            Fork
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--vox-border)] bg-[var(--vox-surface-1)] px-3 py-1.5 text-xs font-semibold text-text transition hover:bg-[var(--vox-surface-2)]">
            <Share2 className="h-3 w-3" />
            Share
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-aqua px-4 py-1.5 text-xs font-bold text-[#06080f] shadow-lg shadow-aqua/20 transition hover:shadow-aqua/40 hover:brightness-110">
            Deploy
          </button>
        </div>
      </header>

      {/* ── Main split ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── LEFT: Chat panel ── */}
        <div className="flex w-[300px] shrink-0 flex-col border-r border-[var(--vox-border)] bg-[var(--vox-sidebar)] lg:w-[360px]">
          {/* Chat header */}
          <div className="flex h-10 items-center justify-between border-b border-[var(--vox-border)] px-3">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 32 32" fill="none" className="text-aqua">
                <path d="M16 8L22 14L16 20L10 14L16 8Z" fill="currentColor" fillOpacity="0.8" />
                <path d="M16 12L20 16L16 20L12 16L16 12Z" fill="currentColor" />
              </svg>
              <span className="text-xs font-semibold text-text">NOVA Agent</span>
            </div>
            <button type="button" className="grid h-6 w-6 place-items-center rounded text-text-muted transition hover:bg-white/[0.06] hover:text-text" title="New message">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Chat messages */}
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                speakingId={speakingId}
                onStopSpeaking={handleStopSpeaking}
              />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 px-1 py-1">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none" className="text-aqua">
                  <path d="M16 8L22 14L16 20L10 14L16 8Z" fill="currentColor" fillOpacity="0.8" />
                  <path d="M16 12L20 16L16 20L12 16L16 12Z" fill="currentColor" />
                </svg>
                <div className="dot-loader">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {/* ── Plan Cards (approve/cancel) ── */}
            {currentPlan?.length > 0 && !isLoading && (
              <div className="mt-2">
                <PlanCards />
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="border-t border-[var(--vox-border)] px-3 py-1.5">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted">
                  NOVA · Running for {elapsedSeconds}s
                </span>
              </div>
            ) : (
              <div className="h-4" />
            )}
            <StepIndicator plan={currentPlan} loadingStage={loadingStage} />
          </div>

          {/* Chat input */}
          <div className="border-t border-[var(--vox-border)] px-3 py-2.5">
            <div className="rounded-xl border border-[var(--vox-border)] bg-[var(--vox-surface-1)] px-3 py-2">
              <input
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={disabled}
                placeholder="Make changes, add new features, ask for anything"
                className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted disabled:opacity-50"
              />
            </div>
            <div className="mt-2 flex items-center gap-1">
              <VoiceButton />

              <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.md,.json,.csv,.yaml,.yml" onChange={handleFile} />
              <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={handleImage} />

              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={disabled}
                className="grid h-8 w-8 place-items-center rounded-full text-text-muted transition hover:bg-white/[0.06] hover:text-text disabled:opacity-50"
                title="Attach image"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="grid h-8 w-8 place-items-center rounded-full text-text-muted transition hover:bg-white/[0.06] hover:text-text disabled:opacity-50"
                title="Upload file"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Preview / Code ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PreviewPanel previewArtifact={previewArtifact} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

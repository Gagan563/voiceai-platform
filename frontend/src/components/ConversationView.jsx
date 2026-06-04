import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Target,
  User,
  XCircle,
} from "lucide-react";
import useAppStore from "@/store/appStore";
import SpeakingIndicator from "./SpeakingIndicator";
import useTTS from "@/hooks/useTTS";
import useElevenLabs from "@/hooks/useElevenLabs";

const messageVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 26 },
  },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
};

const actionStyles = {
  schedule: "border-aqua/25 bg-aqua/10 text-aqua",
  create: "border-leaf/25 bg-leaf/10 text-leaf",
  search: "border-brand/25 bg-brand/10 text-brand",
  remind: "border-amber/25 bg-amber/10 text-amber",
  automate: "border-coral/25 bg-coral/10 text-coral",
  answer: "border-aqua/25 bg-aqua/10 text-aqua",
  control: "border-danger/25 bg-danger/10 text-danger",
};

function formatValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function IntentDisplay({ intent }) {
  if (!intent) return null;

  const entityEntries = Object.entries(intent.entities || {});
  const missingInfo = intent.missing_info || [];
  const confidence = Number(intent.confidence || 0);

  return (
    <div className="nova-card mt-3 rounded-lg p-3">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-aqua" />
        <span className="font-mono text-[11px] font-bold uppercase text-brand">
          Detected intent
        </span>
      </div>

      <div className="grid gap-2 text-xs">
        <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-text-muted">Goal</span>
          <span className="min-w-0 text-text-soft">{intent.goal}</span>
        </div>

        <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2">
          <span className="font-semibold text-text-muted">Action</span>
          <span
            className={`w-fit rounded border px-2 py-1 font-mono text-[11px] font-semibold ${
              actionStyles[intent.action_type] || actionStyles.answer
            }`}
          >
            {intent.action_type || "unknown"}
          </span>
        </div>

        <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2">
          <span className="font-semibold text-text-muted">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.min(confidence * 100, 100)}%` }}
              />
            </div>
            <span className="font-code text-[11px] text-text-muted">
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>

        {entityEntries.length > 0 && (
          <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
            <span className="pt-1 font-semibold text-text-muted">Entities</span>
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {entityEntries.map(([key, value]) => (
                <span
                  key={key}
                  className="max-w-full rounded border border-line bg-panel px-2 py-1 font-mono text-[11px] text-text-soft"
                >
                  <span className="font-semibold text-text">{key}</span>:{" "}
                  {formatValue(value)}
                </span>
              ))}
            </div>
          </div>
        )}

        {missingInfo.length > 0 && (
          <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2">
            <span className="pt-1 font-semibold text-text-muted">Missing</span>
            <div className="flex flex-wrap gap-1.5">
              {missingInfo.map((info) => (
                <span
                  key={info}
                  className="rounded-lg border border-amber/25 bg-amber/10 px-2 py-1 text-[11px] font-medium text-amber"
                >
                  {info}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator({ stage }) {
  const stageText = {
    intent: "Reading intent",
    plan: "Building plan",
    execute: "Executing",
  };

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className="flex items-start gap-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-aqua/15 text-aqua ring-1 ring-aqua/25">
        <Bot className="h-4.5 w-4.5" />
      </div>
      <div className="rounded-2xl rounded-tl-md border border-line bg-panel/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="dot-loader" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="text-sm font-medium text-text-muted">
            {stageText[stage] || "Thinking"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

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
        {confidence !== null ? (
          <span className="font-code text-[11px] text-text-muted">{confidence}%</span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-text-soft">{review.summary}</p>
      {review.issues?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {review.issues.slice(0, 3).map((issue) => (
            <span
              key={issue}
              className="rounded-lg border border-amber/25 bg-amber/10 px-2 py-1 text-[11px] font-medium text-amber"
            >
              {issue}
            </span>
          ))}
        </div>
      ) : null}
      {batches.length ? (
        <div className="mt-2 text-[11px] font-medium text-text-muted">
          {batches.filter((batch) => batch.mode === "parallel").length} parallel batch(es)
        </div>
      ) : null}
    </div>
  );
}

function MessageIcon({ role, type }) {
  if (role === "user") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-text text-ink-950 shadow-lg shadow-black/20">
        <User className="h-4.5 w-4.5" />
      </div>
    );
  }

  if (role === "system" || type === "error") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger ring-1 ring-danger/25">
        <AlertCircle className="h-4.5 w-4.5" />
      </div>
    );
  }

  if (type === "execution_confirmation") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf/15 text-leaf ring-1 ring-leaf/25">
        <CheckCircle2 className="h-4.5 w-4.5" />
      </div>
    );
  }

  if (type === "plan_intro") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/15 text-amber ring-1 ring-amber/25">
        <ClipboardList className="h-4.5 w-4.5" />
      </div>
    );
  }

  if (type === "plan_cancelled") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-text-muted ring-1 ring-line">
        <XCircle className="h-4.5 w-4.5" />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel font-heading text-sm font-bold text-brand">
      N
    </div>
  );
}

export default function ConversationView() {
  const messages = useAppStore((s) => s.messages);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingStage = useAppStore((s) => s.loadingStage);
  const settings = useAppStore((s) => s.settings);
  const speakingId = useAppStore((s) => s.speakingId);
  const setSpeakingMessageId = useAppStore((s) => s.setSpeakingMessageId);
  const scrollRef = useRef(null);
  const prevMessageCountRef = useRef(messages.length);

  // TTS hooks
  const browserTTS = useTTS();
  const elevenLabsTTS = useElevenLabs();

  const activeTTS = settings.ttsMode === "elevenlabs" ? elevenLabsTTS : browserTTS;

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  // Auto-speak new AI messages when TTS is enabled
  useEffect(() => {
    if (!settings.ttsEnabled) return;
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length;
      return;
    }

    prevMessageCountRef.current = messages.length;

    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg &&
      (lastMsg.role === "assistant") &&
      lastMsg.type !== "intent" &&
      lastMsg.content
    ) {
      setSpeakingMessageId(lastMsg.id);
      activeTTS.speak(lastMsg.content);
    }
  }, [activeTTS, messages, setSpeakingMessageId, settings.ttsEnabled]);

  // Clear speakingId when speech ends
  useEffect(() => {
    if (!activeTTS.isSpeaking && speakingId) {
      setSpeakingMessageId(null);
    }
  }, [activeTTS.isSpeaking, setSpeakingMessageId, speakingId]);

  const handleStopSpeaking = () => {
    activeTTS.stop();
    setSpeakingMessageId(null);
  };

  if (messages.length === 0 && !isLoading) return null;

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => {
            const isUser = msg.role === "user";

            return (
              <motion.div
                key={msg.id}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                className={`flex items-start gap-3 ${
                  isUser ? "flex-row-reverse" : ""
                }`}
              >
                <MessageIcon role={msg.role} type={msg.type} />

                <div
                  className={`max-w-[min(80%,720px)] px-4 py-3 ${
                    isUser
                      ? "rounded-[18px] rounded-br bg-brand/95 text-ink-950 shadow-[0_0_24px_rgba(174,203,250,0.2)]"
                      : msg.type === "error"
                        ? "nova-card rounded-lg border-danger/30 bg-danger/10 text-danger"
                        : "nova-card rounded-lg text-text"
                  }`}
                >
                  <p className="whitespace-pre-line text-sm leading-relaxed">
                    {msg.content}
                  </p>

                  {msg.type === "intent" && msg.intent ? (
                    <IntentDisplay intent={msg.intent} />
                  ) : null}

                  {msg.type === "execution_confirmation" && msg.execution?.review ? (
                    <ExecutionReview
                      review={msg.execution.review}
                      batches={msg.execution.batches || []}
                    />
                  ) : null}

                  <span
                    className={`mt-2 block font-code text-[10px] ${
                      isUser ? "text-ink-700" : "text-text-muted"
                    } ${isUser ? "text-right" : ""}`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Speaking indicator */}
                {speakingId === msg.id && (
                  <div className="mt-1">
                    <SpeakingIndicator onStop={handleStopSpeaking} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoading ? <TypingIndicator stage={loadingStage} /> : null}

        <div className="flex items-center justify-center pt-2 text-[11px] font-medium text-text-muted">
          <Layers3 className="mr-1.5 h-3.5 w-3.5 text-aqua" />
          {messages.length} messages in this session
        </div>
      </div>
    </div>
  );
}

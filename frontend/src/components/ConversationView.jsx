import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  CornerDownLeft,
  Layers3,
  Pencil,
  RotateCcw,
  User,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";
import useAppStore from "@/store/appStore";
import SpeakingIndicator from "./SpeakingIndicator";
import useTTS from "@/hooks/useTTS";
import useElevenLabs from "@/hooks/useElevenLabs";

const messageVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 340, damping: 28 },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy code:", err);
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-line/70 bg-[#070a12] shadow-md">
      <div className="flex items-center justify-between border-b border-line/50 bg-[#0d1220] px-3.5 py-1.5 text-xs text-text-muted">
        <span className="font-code text-[11px] font-bold uppercase tracking-wider text-aqua">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium text-text-muted transition-all hover:bg-white/[0.08] hover:text-text"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-leaf" />
              <span className="text-leaf font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-code text-xs leading-relaxed text-[#e2e8f0]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FormattedMessageContent({ text, isUser }) {
  if (!text) return null;

  if (isUser) {
    return <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>;
  }

  // Parse code blocks
  const parts = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: "code",
      language: match[1] || "code",
      content: match[2].trimEnd(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {parts.map((part, i) => {
        if (part.type === "code") {
          return <CodeBlock key={i} language={part.language} code={part.content} />;
        }
        return (
          <p key={i} className="whitespace-pre-line text-sm leading-relaxed">
            {part.content}
          </p>
        );
      })}
    </div>
  );
}

function TypingIndicator({ stage }) {
  const stageText = {
    intent: "Thinking",
    plan: "Crafting response",
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
      <div className="rounded-2xl rounded-tl-md border border-line bg-panel/80 px-4 py-3 shadow-lg shadow-black/10 backdrop-blur-md">
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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-teal-400 text-ink-950 shadow-md shadow-cyan-500/20 ring-1 ring-white/20">
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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-aqua/30 bg-gradient-to-br from-panel via-panel-raised to-aqua/10 font-heading text-sm font-bold text-brand shadow-sm shadow-black/20 ring-1 ring-aqua/20">
      N
    </div>
  );
}

function MessageItem({
  msg,
  isSpeaking,
  onSpeak,
  onStopSpeaking,
  onEditSubmit,
  onRegenerate,
  isLoading,
}) {
  const isUser = msg.role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content || msg.text || "");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleCopy = useCallback(async () => {
    try {
      const textToCopy = msg.content || msg.text || "";
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy text:", err);
    }
  }, [msg.content, msg.text]);

  const handleTextareaChange = (e) => {
    setEditText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitEdit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(msg.content || msg.text || "");
    }
  };

  const handleSubmitEdit = () => {
    const clean = editText.trim();
    if (!clean) return;
    setIsEditing(false);
    onEditSubmit(msg.id, clean);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(msg.content || msg.text || "");
  };

  return (
    <motion.div
      key={msg.id}
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={`group relative flex items-start gap-3 ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      <MessageIcon role={msg.role} type={msg.type} />

      <div className="flex max-w-[min(88%,740px)] flex-col gap-1.5">
        {/* Main Message Bubble */}
        <div
          className={`relative px-4 py-3 transition-all duration-200 ${
            isUser
              ? isEditing
                ? "w-[min(100%,640px)] rounded-2xl border border-cyan-500/40 bg-panel-raised shadow-xl shadow-cyan-500/10"
                : "rounded-2xl rounded-tr-sm bg-gradient-to-br from-cyan-500/90 via-cyan-600/90 to-teal-600/90 text-white shadow-lg shadow-cyan-900/20 ring-1 ring-white/15"
              : msg.type === "error"
                ? "nova-card rounded-2xl rounded-tl-sm border-danger/30 bg-danger/10 text-danger"
                : "nova-card rounded-2xl rounded-tl-sm border-line/60 bg-panel/90 text-text shadow-md shadow-black/20 backdrop-blur-md"
          }`}
        >
          {isEditing ? (
            /* Inline Edit View (Claude style) */
            <div className="flex flex-col gap-3">
              <textarea
                ref={textareaRef}
                value={editText}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                rows={2}
                className="w-full resize-none bg-transparent text-sm leading-relaxed text-text outline-none placeholder:text-text-muted"
                placeholder="Edit your prompt..."
              />
              <div className="flex items-center justify-end gap-2 border-t border-line/50 pt-2.5">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-white/5 hover:text-text"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitEdit}
                  disabled={!editText.trim() || isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1 text-xs font-semibold text-ink-950 shadow-md transition-all hover:opacity-95 disabled:opacity-50"
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  Save & Submit
                </button>
              </div>
            </div>
          ) : (
            /* Regular Message Content with Code Highlighting */
            <>
              <FormattedMessageContent
                text={msg.content || msg.text}
                isUser={isUser}
              />

              {msg.type === "execution_confirmation" && msg.execution?.review ? (
                <ExecutionReview
                  review={msg.execution.review}
                  batches={msg.execution.batches || []}
                />
              ) : null}
            </>
          )}
        </div>

        {/* Action Bar (Claude-style bottom action icons) */}
        {!isEditing && (
          <div
            className={`flex items-center gap-1 px-1 transition-opacity duration-200 ${
              isUser
                ? "justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                : "justify-start opacity-75 group-hover:opacity-100"
            }`}
          >
            {/* Timestamp */}
            <span className="mr-1.5 font-code text-[10px] text-text-muted">
              {new Date(msg.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? "Copied to clipboard!" : "Copy text"}
              aria-label="Copy text"
              className="inline-flex h-6.5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-text-muted transition-all hover:bg-white/[0.08] hover:text-text"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-leaf" />
                  <span className="text-leaf">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>

            {/* Edit Button (For user messages - Claude style) */}
            {isUser && (
              <button
                type="button"
                onClick={() => {
                  setEditText(msg.content || msg.text || "");
                  setIsEditing(true);
                }}
                title="Edit message"
                aria-label="Edit message"
                className="inline-flex h-6.5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-text-muted transition-all hover:bg-white/[0.08] hover:text-text"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            {/* Retry / Regenerate Button (For assistant messages) */}
            {!isUser && msg.type !== "error" && onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(msg.id)}
                disabled={isLoading}
                title="Retry response"
                aria-label="Retry response"
                className="inline-flex h-6.5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-text-muted transition-all hover:bg-white/[0.08] hover:text-text disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Retry</span>
              </button>
            )}

            {/* Read Aloud / Speak Button (For assistant messages) */}
            {!isUser && msg.content && (
              <button
                type="button"
                onClick={() => (isSpeaking ? onStopSpeaking() : onSpeak(msg.id, msg.content))}
                title={isSpeaking ? "Stop speaking" : "Read aloud"}
                aria-label={isSpeaking ? "Stop speaking" : "Read aloud"}
                className={`inline-flex h-6.5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium transition-all ${
                  isSpeaking
                    ? "bg-aqua/15 text-aqua font-semibold"
                    : "text-text-muted hover:bg-white/[0.08] hover:text-text"
                }`}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="h-3.5 w-3.5" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Listen</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Speaking animation indicator when active */}
        {isSpeaking && (
          <div className="mt-1">
            <SpeakingIndicator onStop={onStopSpeaking} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function ConversationView() {
  const messages = useAppStore((s) => s.messages);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingStage = useAppStore((s) => s.loadingStage);
  const settings = useAppStore((s) => s.settings);
  const speakingId = useAppStore((s) => s.speakingId);
  const setSpeakingMessageId = useAppStore((s) => s.setSpeakingMessageId);
  const editAndResubmitMessage = useAppStore((s) => s.editAndResubmitMessage);
  const regenerateResponse = useAppStore((s) => s.regenerateResponse);
  const scrollRef = useRef(null);
  const prevMessageCountRef = useRef(messages.length);

  // TTS hooks
  const browserTTS = useTTS({ rate: settings.speechRate });
  const elevenLabsTTS = useElevenLabs({ rate: settings.speechRate });

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
      lastMsg.role === "assistant" &&
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

  const handleSpeak = (id, text) => {
    setSpeakingMessageId(id);
    activeTTS.speak(text);
  };

  const handleStopSpeaking = () => {
    activeTTS.stop();
    setSpeakingMessageId(null);
  };

  const handleEditSubmit = (messageId, newText) => {
    editAndResubmitMessage(messageId, newText);
  };

  const handleRegenerate = (assistantMessageId) => {
    regenerateResponse(assistantMessageId);
  };

  if (messages.length === 0 && !isLoading) return null;

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-5 sm:px-6">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              isSpeaking={speakingId === msg.id}
              onSpeak={handleSpeak}
              onStopSpeaking={handleStopSpeaking}
              onEditSubmit={handleEditSubmit}
              onRegenerate={handleRegenerate}
              isLoading={isLoading}
            />
          ))}
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

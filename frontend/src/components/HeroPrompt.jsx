import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { VoiceButton } from "@/components/VoiceButton";
import { analyzeContextDocument, analyzeContextImage } from "@/api/client";
import useAppStore from "@/store/appStore";

/* NOVA orb SVG — unique brand element */
function NovaOrb() {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      className="nova-orb-anim"
    >
      <defs>
        <radialGradient id="orb-glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#a78bfa" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#06080f" stopOpacity="0" />
        </radialGradient>
        <filter id="orb-blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
      </defs>
      <circle cx="28" cy="28" r="22" fill="url(#orb-glow)" filter="url(#orb-blur)" />
      <circle cx="28" cy="28" r="14" fill="#22d3ee" fillOpacity="0.12" />
      <circle cx="28" cy="28" r="6" fill="#22d3ee" fillOpacity="0.6" />
    </svg>
  );
}

export default function HeroPrompt({ onSubmit }) {
  const [text, setText] = useState("");
  const [contextBusy, setContextBusy] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const isLoading = useAppStore((s) => s.isLoading);

  const disabled = isLoading || contextBusy;

  const send = () => {
    if (disabled || !text.trim()) return;
    onSubmit(text);
    setText("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleFile = async (e) => {
    const [file] = Array.from(e.target.files || []);
    e.target.value = "";
    if (!file || disabled) return;
    setContextBusy(true);
    try {
      const result = await analyzeContextDocument(file);
      onSubmit(result.prompt || `Requirements file: ${file.name}\n\n${result.text || result.summary || ""}`);
    } catch (err) {
      onSubmit(`Requirements file upload failed for ${file.name}: ${err.message || "unknown error"}`);
    } finally {
      setContextBusy(false);
    }
  };

  const handleImage = async (e) => {
    const [file] = Array.from(e.target.files || []);
    e.target.value = "";
    if (!file || disabled) return;
    setContextBusy(true);
    try {
      const result = await analyzeContextImage(file, "Summarize this image for my next voice command.", "image");
      onSubmit(`Image context from ${file.name}:\n\n${result.analysis}`);
    } catch (err) {
      onSubmit(`Image context upload failed: ${err.message || "unknown error"}`);
    } finally {
      setContextBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-[680px]">
        {/* Nova orb + title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-10 flex flex-col items-center text-center"
        >
          <NovaOrb />
          <h1 className="mt-4 font-heading text-[28px] font-bold leading-tight tracking-tight text-text sm:text-[36px]">
            What do you want to build?
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Describe your idea — NOVA will plan, build, and preview it for you.
          </p>
        </motion.div>

        {/* Input box */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        >
          <div className="nova-card rounded-2xl px-4 pb-3 pt-4 glow-pulse">
            {/* Text area */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder="e.g. Build me a task manager with drag-and-drop..."
              rows={3}
              className="w-full resize-none bg-transparent text-base text-text outline-none placeholder:text-text-muted disabled:opacity-50"
              data-testid="hero-text-input"
            />

            {/* Bottom row: mic, attach, file, send */}
            <div className="mt-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <VoiceButton />

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".docx,.txt,.md,.markdown,.json,.csv,.yaml,.yml"
                  onChange={handleFile}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImage}
                />

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={disabled}
                  className="grid h-9 w-9 place-items-center rounded-full text-text-muted transition hover:bg-aqua/10 hover:text-aqua disabled:opacity-50"
                  title="Attach image"
                  aria-label="Attach image"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="grid h-9 w-9 place-items-center rounded-full text-text-muted transition hover:bg-aqua/10 hover:text-aqua disabled:opacity-50"
                  title="Upload file"
                  aria-label="Upload file"
                >
                  <Plus className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* Send button */}
              <button
                type="button"
                onClick={send}
                disabled={disabled || !text.trim()}
                className={[
                  "inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200",
                  disabled || !text.trim()
                    ? "cursor-not-allowed bg-vox-s2 text-text-muted"
                    : "bg-aqua text-[#06080f] shadow-lg shadow-aqua/20 hover:shadow-aqua/40 hover:brightness-110",
                ].join(" ")}
                data-testid="send-button"
              >
                Build
              </button>
            </div>
          </div>

          {/* Aurora glow line */}
          <div className="hero-gradient-line mt-0" />
        </motion.div>
      </div>
    </div>
  );
}

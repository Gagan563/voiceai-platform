import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  Cpu,
  KeyRound,
  Palette,
  Plug,
  Save,
  Volume2,
  X,
} from "lucide-react";
import useAppStore from "@/store/appStore";

const panelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } },
};

const modelOptions = [
  { value: "claude-sonnet-4-20250514", label: "Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Opus 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Sonnet 3.5" },
];

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-brand/40"
      />
    </label>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[var(--vox-surface-1)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand" />
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function SettingsPanel({ isOpen, onClose }) {
  const settings = useAppStore((state) => state.settings);
  const setApiKey = useAppStore((state) => state.setApiKey);
  const setSetting = useAppStore((state) => state.setSetting);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const toggleTtsEnabled = useAppStore((state) => state.toggleTtsEnabled);
  const toggleTtsMode = useAppStore((state) => state.toggleTtsMode);
  const toggleAutopilot = useAppStore((state) => state.toggleAutopilot);
  const [saved, setSaved] = useState(false);

  const markSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <AnimatePresence>
      {isOpen ? (
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
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[rgba(255,255,255,0.06)] bg-[var(--vox-bg)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold text-text">Settings</h2>
                <p className="text-xs text-text-muted">Keys, model, voice, and appearance</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-white/[0.06] hover:text-text"
                aria-label="Close settings"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Model & Autopilot */}
              <Section icon={Cpu} title="Model & Behavior">
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">
                    AI Model
                  </span>
                  <select
                    value={settings.selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 py-2 text-sm text-text outline-none"
                    aria-label="Select AI model"
                  >
                    {modelOptions.map((model) => (
                      <option
                        key={model.value}
                        value={model.value}
                        className="bg-[var(--vox-bg)] text-text"
                      >
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-[var(--vox-bg)] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-leaf" />
                    <span className="text-sm text-text">Autopilot</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAutopilot}
                    className={`relative h-6 w-11 rounded-full transition ${
                      settings.autopilotEnabled
                        ? "bg-leaf"
                        : "bg-[rgba(255,255,255,0.12)]"
                    }`}
                    aria-pressed={settings.autopilotEnabled}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        settings.autopilotEnabled
                          ? "translate-x-[22px]"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </Section>

              {/* API Keys */}
              <Section icon={KeyRound} title="API Keys">
                <Field
                  label="Gemini / backend key"
                  value={settings.apiKeys.anthropic}
                  onChange={(value) => setApiKey("anthropic", value)}
                  type="password"
                  placeholder="Stored locally for client metadata"
                />
                <Field
                  label="OpenAI Whisper key"
                  value={settings.apiKeys.openai}
                  onChange={(value) => setApiKey("openai", value)}
                  type="password"
                  placeholder="Also set OPENAI_API_KEY in backend/.env"
                />
                <Field
                  label="ElevenLabs key"
                  value={settings.apiKeys.elevenlabs}
                  onChange={(value) => setApiKey("elevenlabs", value)}
                  type="password"
                />
              </Section>

              {/* Voice & TTS */}
              <Section icon={Volume2} title="Voice & TTS">
                <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-[var(--vox-bg)] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-brand" />
                    <span className="text-sm text-text">Text-to-Speech</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTtsEnabled}
                    className={`relative h-6 w-11 rounded-full transition ${
                      settings.ttsEnabled
                        ? "bg-brand"
                        : "bg-[rgba(255,255,255,0.12)]"
                    }`}
                    aria-pressed={settings.ttsEnabled}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        settings.ttsEnabled
                          ? "translate-x-[22px]"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSetting("sttMode", "whisper")}
                    className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-bold text-brand"
                  >
                    Whisper STT
                  </button>
                  <button
                    type="button"
                    onClick={toggleTtsMode}
                    className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 py-2 text-xs font-bold text-text-soft"
                  >
                    TTS: {settings.ttsMode}
                  </button>
                </div>
              </Section>

              {/* Integrations */}
              <Section icon={Plug} title="Integrations">
                <Field
                  label="Home Assistant URL"
                  value={settings.homeAssistantUrl || ""}
                  onChange={(value) => setSetting("homeAssistantUrl", value)}
                  placeholder="http://homeassistant.local:8123"
                />
                <Field
                  label="Home Assistant token"
                  value={settings.homeAssistantToken || ""}
                  onChange={(value) => setSetting("homeAssistantToken", value)}
                  type="password"
                />
              </Section>

              {/* Appearance */}
              <Section icon={Palette} title="Appearance">
                <select
                  value={settings.fontSize}
                  onChange={(event) => setSetting("fontSize", event.target.value)}
                  className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--vox-bg)] px-3 py-2 text-sm text-text outline-none"
                >
                  <option value="small">Small font</option>
                  <option value="medium">Medium font</option>
                  <option value="large">Large font</option>
                </select>
              </Section>
            </div>

            <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-3">
              <button
                type="button"
                onClick={markSaved}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-[var(--vox-bg)] transition hover:brightness-110"
              >
                {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? "Saved" : "Save settings"}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

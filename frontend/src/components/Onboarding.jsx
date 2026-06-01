import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, KeyRound, Mic, Sparkles } from "lucide-react";
import useAppStore from "@/store/appStore";

const steps = [
  { title: "Meet VoxMind", icon: Sparkles, text: "A voice-first workspace for tasks, writing, research, learning, and everyday tools." },
  { title: "Microphone", icon: Mic, text: "Allow microphone access so VoxMind can capture audio with MediaRecorder." },
  { title: "API Keys", icon: KeyRound, text: "Add backend keys in backend/.env. Whisper needs OPENAI_API_KEY." },
  { title: "Ready", icon: CheckCircle2, text: "You can speak, type, approve plans, and save results into modules." },
];

export default function Onboarding() {
  const hasOnboarded = useAppStore((state) => state.hasOnboarded);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const [step, setStep] = useState(0);
  const current = steps[step];
  const Icon = current.icon;

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setStep(2);
    } catch {
      setStep(2);
    }
  };

  return (
    <AnimatePresence>
      {!hasOnboarded ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-4 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            className="w-full max-w-lg rounded-[2rem] border border-line bg-ink-950 p-6 shadow-2xl"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand/15 text-brand ring-1 ring-brand/25">
              <Icon className="h-7 w-7" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-semibold text-text">{current.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">{current.text}</p>

            <div className="mt-6 grid grid-cols-4 gap-2">
              {steps.map((item, index) => (
                <div
                  key={item.title}
                  className={`h-1.5 rounded-full ${index <= step ? "bg-brand" : "bg-white/[0.08]"}`}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((value) => value - 1)}
                  className="h-10 rounded-xl border border-line bg-white/[0.04] px-4 text-sm font-bold text-text-soft"
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (step === 1) {
                    requestMic();
                    return;
                  }
                  if (step === steps.length - 1) {
                    completeOnboarding();
                    return;
                  }
                  setStep((value) => value + 1);
                }}
                className="h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white"
              >
                {step === steps.length - 1 ? "Start Talking" : step === 1 ? "Allow microphone" : "Next"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

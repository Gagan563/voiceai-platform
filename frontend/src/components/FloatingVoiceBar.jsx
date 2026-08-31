import { useState, useEffect, useRef } from "react";
import { Mic, Sparkles, X, CornerDownLeft, Radio } from "lucide-react";
import { BACKEND_URL } from "../config";
import { sendLocalNotification } from "../lib/notifications";

/**
 * FloatingVoiceBar — Raycast / Siri-style minimalist floating assistant overlay.
 * Global hotkey `Ctrl+K` or `Alt+Space` opens instant voice/text prompt bar anywhere in the app.
 */
export default function FloatingVoiceBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const stopSpeech = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const promptText = query.trim();
    if (!promptText) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch(`${BACKEND_URL}/chat/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: promptText }),
      });
      const data = await res.json();
      setResponse(data.answer || "Done.");

      // Also trigger a subtle system notification if user is backgrounded
      sendLocalNotification("NOVA Assistant", { body: data.answer?.slice(0, 80) });
    } catch {
      setResponse("Could not connect to NOVA server.");
    }

    setIsLoading(false);
  };

  const toggleSpeech = () => {
    if (isRecording) {
      stopSpeech();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setQuery(text);
    };
    recognition.onend = () => {
      setIsRecording(false);
      if (query.trim()) {
        handleSubmit();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Global hotkey listener (Ctrl+K or Alt+Space)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.key === "k") || (e.altKey && e.code === "Space")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    let timer;
    if (isOpen) {
      timer = setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => {
      if (timer) clearTimeout(timer);
      stopSpeech();
    };
  }, [isOpen]);

  return (
    <>
      {/* Mini floating quick toggle trigger button in bottom right */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 text-slate-200 shadow-2xl backdrop-blur-md hover:scale-105 transition-all text-xs font-semibold group"
        title="Open Quick Assistant (Ctrl+K or Alt+Space)"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 group-hover:animate-ping" />
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <span>NOVA Quick</span>
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Ctrl+K</kbd>
      </button>

      {/* Full Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 sm:pt-32 bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-xl bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
              <button
                type="button"
                onClick={toggleSpeech}
                className={`p-2 rounded-xl transition ${
                  isRecording
                    ? "bg-red-500/20 text-red-400 animate-pulse border border-red-500/40"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
                title={isRecording ? "Stop voice" : "Speak voice command"}
              >
                {isRecording ? <Radio className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask NOVA anything or speak a command..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white transition"
              >
                <CornerDownLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-500 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </form>

            {/* Response Area */}
            {(isLoading || response) && (
              <div className="p-4 bg-slate-950/60 max-h-64 overflow-y-auto text-xs sm:text-sm font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
                    <Sparkles className="w-4 h-4" />
                    <span>NOVA is thinking...</span>
                  </div>
                ) : (
                  response
                )}
              </div>
            )}

            {/* Footer Tips */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-950 text-[11px] text-slate-500 border-t border-slate-800/60">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-400">Esc</kbd> to close</span>
              <span>Quick Voice & Command HUD</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

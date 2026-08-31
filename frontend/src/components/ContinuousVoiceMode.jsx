import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, X, Sparkles, Radio, MessageSquare } from "lucide-react";
import VoiceOrb from "./VoiceOrb";
import { BACKEND_URL } from "../config";

/**
 * ContinuousVoiceMode — Immersive hands-free bidirectional voice conversation mode.
 * Auto-detects speech pauses, streams AI answers, and plays voice output naturally.
 */
export default function ContinuousVoiceMode({ isOpen, onClose, onSendMessage }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [conversation, setConversation] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimeoutRef = useRef(null);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (!isOpen) {
      stopVoiceSession();
      return;
    }

    startVoiceSession();

    return () => {
      stopVoiceSession();
    };
  }, [isOpen]);

  const startVoiceSession = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setTranscript("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const currentText = final || interim;
      if (currentText.trim()) {
        setTranscript(currentText);

        // Reset silence timer for turn-taking
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(() => {
          if (currentText.trim() && !isSpeaking) {
            handleUserUtterance(currentText.trim());
          }
        }, 1500);
      }
    };

    recognition.onerror = (err) => {
      console.warn("Speech recognition error:", err.error);
    };

    recognition.onend = () => {
      if (isOpen && isListening) {
        try {
          recognition.start();
        } catch {
          // ignore already started
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // already active
    }

    // Connect AudioContext for microphone level
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 64;

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
          setAudioLevel(avg / 128);
          requestAnimationFrame(checkLevel);
        };
        checkLevel();
      })
      .catch((err) => console.warn("Mic meter failed:", err));
  };

  const stopVoiceSession = () => {
    setIsListening(false);
    setIsSpeaking(false);
    clearTimeout(silenceTimeoutRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleUserUtterance = async (userText) => {
    setConversation((prev) => [...prev, { role: "user", text: userText }]);
    setTranscript("");
    setAiResponse("Thinking...");

    try {
      const res = await fetch(`${BACKEND_URL}/chat/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText }),
      });
      const data = await res.json();
      const answer = data.answer || "I heard you, but couldn't generate a response.";
      setAiResponse(answer);
      setConversation((prev) => [...prev, { role: "assistant", text: answer }]);

      if (!isMuted && window.speechSynthesis) {
        speakResponse(answer);
      }
    } catch {
      const fallback = "I'm having trouble reaching the server right now.";
      setAiResponse(fallback);
      if (!isMuted) speakResponse(fallback);
    }
  };

  const speakResponse = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-2xl p-4 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col items-center text-center overflow-hidden">
        {/* Header Controls */}
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
            <Radio className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
            <span>Continuous Live Voice</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isSpeaking) window.speechSynthesis?.cancel();
                setIsMuted(!isMuted);
              }}
              className="p-2.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title={isMuted ? "Unmute Voice" : "Mute Voice"}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Voice Orb */}
        <div className="my-6">
          <VoiceOrb
            isListening={isListening}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            size={240}
            onClick={() => {
              if (isSpeaking) {
                window.speechSynthesis?.cancel();
                setIsSpeaking(false);
              }
            }}
          />
        </div>

        {/* State Label */}
        <div className="text-sm font-medium text-slate-400 mb-4 h-6 flex items-center gap-2">
          {isSpeaking ? (
            <span className="text-pink-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 animate-spin" /> NOVA is speaking... (Click orb to interrupt)
            </span>
          ) : isListening ? (
            <span className="text-sky-400 flex items-center gap-1.5">
              <Mic className="w-4 h-4 animate-bounce" /> Listening... Speak freely
            </span>
          ) : (
            <span>Connecting voice session...</span>
          )}
        </div>

        {/* Transcript Box */}
        <div className="w-full max-h-48 overflow-y-auto bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-left space-y-3">
          {conversation.length === 0 && !transcript && (
            <p className="text-slate-500 text-sm text-center py-4">
              Speak a prompt or question like &quot;What are my top priorities today?&quot;
            </p>
          )}

          {conversation.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 text-sm ${
                msg.role === "user" ? "text-sky-300 font-medium" : "text-slate-200"
              }`}
            >
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 mt-0.5">
                {msg.role === "user" ? "You" : "NOVA"}
              </span>
              <p className="flex-1">{msg.text}</p>
            </div>
          ))}

          {transcript && (
            <div className="flex items-start gap-2 text-sm text-sky-400 animate-pulse">
              <span className="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-400 mt-0.5">You</span>
              <p className="flex-1">{transcript}...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for browser-native text-to-speech using speechSynthesis API.
 *
 * Returns:
 *   speak(text)      — speak the given text
 *   stop()           — stop speaking immediately
 *   isSpeaking       — true while speech is in progress
 *   voices           — available SpeechSynthesisVoice list
 *   selectedVoice    — currently selected voice (or null for default)
 *   setSelectedVoice — set the voice to use
 *   isSupported      — true if the browser supports speechSynthesis
 */
export default function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const utteranceRef = useRef(null);

  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Load available voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);

      // Auto-select a good English voice if none selected
      if (!selectedVoice && available.length > 0) {
        const preferred = available.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Google") ||
              v.name.includes("Microsoft") ||
              v.name.includes("Samantha") ||
              v.name.includes("Daniel"))
        );
        if (preferred) setSelectedVoice(preferred);
      }
    };

    loadVoices();

    // Voices may load asynchronously in Chrome
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported, selectedVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  /**
   * Speak the given text aloud.
   */
  const speak = useCallback(
    (text) => {
      if (!isSupported || !text) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        // "interrupted" is normal when we cancel, don't treat as error
        if (event.error !== "interrupted") {
          console.error("[useTTS] Speech error:", event.error);
        }
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, selectedVoice]
  );

  /**
   * Stop speaking immediately.
   */
  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return {
    speak,
    stop,
    isSpeaking,
    voices,
    selectedVoice,
    setSelectedVoice,
    isSupported,
  };
}

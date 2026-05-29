import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Custom hook for browser-native speech-to-text using the Web Speech API.
 *
 * Returns:
 *   isRecording    — true while actively listening
 *   transcript     — live transcript text as the user speaks
 *   startRecording — call to begin listening
 *   stopRecording  — call to stop listening
 *   error          — error message string or null
 *   isSupported    — true if the browser supports Web Speech API
 */
export default function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef("");

  // Check browser support
  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognition;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Browser recognition abort can throw after it has already ended.
        }
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  /**
   * Reset the silence timer — auto-stops recording after 2 seconds of no speech.
   */
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      // Auto-stop after 2 seconds of silence
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
      }
    }, 2000);
  }, [isRecording]);

  /**
   * Start recording — requests mic permission and begins speech recognition.
   */
  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError("Web Speech API is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    setError(null);
    setTranscript("");
    finalTranscriptRef.current = "";

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      resetSilenceTimer();
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        finalTranscriptRef.current = final;
      }

      const fullTranscript = (finalTranscriptRef.current + " " + interim).trim();
      setTranscript(fullTranscript);

      // Reset silence timer on every speech result
      resetSilenceTimer();
    };

    recognition.onerror = (event) => {
      console.error("[useVoice] Recognition error:", event.error);

      const errorMessages = {
        "not-allowed": "Microphone permission denied. Please allow microphone access in your browser settings.",
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "No microphone found. Please connect a microphone.",
        "network": "Network error during speech recognition.",
        "aborted": null, // Intentional abort, not an error
      };

      const msg = errorMessages[event.error] || `Speech recognition error: ${event.error}`;
      if (msg) setError(msg);

      setIsRecording(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      // Set the final transcript
      if (finalTranscriptRef.current) {
        setTranscript(finalTranscriptRef.current.trim());
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      setError(`Failed to start recording: ${err.message}`);
      setIsRecording(false);
    }
  }, [isSupported, SpeechRecognition, resetSilenceTimer]);

  /**
   * Stop recording manually.
   */
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Browser recognition stop can throw after it has already ended.
      }
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  }, []);

  return {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    error,
    isSupported,
  };
}

import { useState, useRef, useCallback, useEffect } from "react";
import { transcribeAudio } from "../api/client";

/**
 * Custom hook for Whisper API speech-to-text.
 * Records audio via MediaRecorder, sends the blob to /transcribe (Whisper API).
 *
 * Returns:
 *   isRecording    — true while actively recording
 *   transcript     — transcribed text from Whisper
 *   startRecording — call to begin recording
 *   stopRecording  — call to stop recording and transcribe
 *   isTranscribing — true while the API call is in flight
 *   error          — error message string or null
 *   isSupported    — true if the browser supports MediaRecorder
 */
export default function useWhisper({ silenceTimeoutMs = 2000 } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [amplitude, setAmplitude] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceStartRef = useRef(null);
  const silenceTimeoutRef = useRef(silenceTimeoutMs);
  const rafIdRef = useRef(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!window.MediaRecorder;

  useEffect(() => {
    const timeout = Number(silenceTimeoutMs);
    silenceTimeoutRef.current = Number.isFinite(timeout)
      ? Math.min(Math.max(timeout, 1000), 5000)
      : 2000;
  }, [silenceTimeoutMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllStreams();
    };
  }, []);

  function stopAllStreams() {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // AudioContext close can throw if the browser already released it.
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setAmplitude(0);
  }

  /**
   * Monitor audio levels and auto-stop after 2 seconds of silence.
   */
  function monitorSilence() {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function check() {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      setAmplitude(avg);
      const isSilent = avg < 10; // Threshold for silence

      if (isSilent) {
        if (!silenceStartRef.current) {
          silenceStartRef.current = Date.now();
        } else if (Date.now() - silenceStartRef.current > silenceTimeoutRef.current) {
          // 2 seconds of silence — auto-stop
          stopRecording();
          return;
        }
      } else {
        silenceStartRef.current = null;
      }

      rafIdRef.current = requestAnimationFrame(check);
    }

    check();
  }

  /**
   * Process the recorded audio blob — send to Whisper API.
   */
  async function processAudio(blob) {
    setIsTranscribing(true);
    setError(null);

    try {
      // Convert blob to File for FormData
      const audioFile = new File([blob], "recording.webm", {
        type: blob.type || "audio/webm",
      });

      const response = await transcribeAudio(audioFile);
      const text = response.transcript || "";
      setTranscript(text);
    } catch (err) {
      const msg = err.message || "Transcription failed";
      setError(msg);
      console.error("[useWhisper] Transcription error:", msg);
    } finally {
      setIsTranscribing(false);
    }
  }

  /**
   * Start recording audio from the microphone.
   */
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("MediaRecorder is not supported in this browser.");
      return;
    }

    setError(null);
    setTranscript("");
    chunksRef.current = [];
    silenceStartRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analysis for silence detection
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stopAllStreams();
        setIsRecording(false);

        if (blob.size > 0) {
          processAudio(blob);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("[useWhisper] MediaRecorder error:", event.error);
        setError(`Recording error: ${event.error?.message || "unknown"}`);
        setIsRecording(false);
        stopAllStreams();
      };

      mediaRecorder.start(250); // Collect data every 250ms
      setIsRecording(true);

      // Start silence monitoring
      monitorSilence();
    } catch (err) {
      console.error("[useWhisper] getUserMedia error:", err);

      if (err.name === "NotAllowedError") {
        setError("Microphone permission denied. Please allow microphone access.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone.");
      } else {
        setError(`Microphone error: ${err.message}`);
      }
    }
    // monitorSilence is intentionally kept as a local function so it can call
    // the current stopRecording implementation during the animation loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  /**
   * Stop recording and trigger transcription.
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // MediaRecorder stop can throw after it has already become inactive.
      }
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
  }, []);

  return {
    isRecording,
    isTranscribing,
    transcript,
    amplitude,
    startRecording,
    stopRecording,
    error,
    isSupported,
  };
}

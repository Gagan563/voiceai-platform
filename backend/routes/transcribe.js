// ============================================
// VoiceAI Platform — Whisper Transcription Route
// ============================================

const express = require("express");
const multer = require("multer");

const router = express.Router();

// Multer config for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg",
      "audio/webm", "audio/flac", "audio/m4a", "audio/mp4",
      "audio/x-wav", "audio/x-m4a", "video/webm",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`), false);
    }
  },
});

/**
 * POST /transcribe
 *
 * Accepts a multipart/form-data audio file upload.
 * Sends it to OpenAI Whisper API for transcription.
 * Falls back to a stub response if OPENAI_API_KEY is not set.
 */
router.post("/", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No audio file provided",
        hint: "Send a multipart/form-data request with an 'audio' field containing a WAV, MP3, OGG, WEBM, or FLAC file.",
      });
    }

    const { originalname, size, mimetype, buffer } = req.file;
    console.log(`[Transcribe] Received: ${originalname} (${(size / 1024).toFixed(1)} KB, ${mimetype})`);

    const openaiKey = process.env.OPENAI_API_KEY;

    // ── If OpenAI key is set, use Whisper API ──
    if (openaiKey && openaiKey !== "sk-xxxxx-your-openai-key-here") {
      console.log("[Transcribe] Using OpenAI Whisper API");

      // Build FormData for the Whisper API
      const FormData = (await import("formdata-node")).FormData;
      const { Blob } = (await import("buffer"));

      const formData = new FormData();
      const audioBlob = new Blob([buffer], { type: mimetype });
      formData.append("file", audioBlob, originalname || "audio.webm");
      formData.append("model", "whisper-1");
      formData.append("language", "en");
      formData.append("response_format", "json");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[Transcribe] Whisper API error:", response.status, errorBody);

        if (response.status === 401) {
          return res.status(401).json({
            error: "Invalid OpenAI API key",
            hint: "Check your OPENAI_API_KEY in the .env file.",
          });
        }

        return res.status(502).json({
          error: "Whisper API request failed",
          details: errorBody,
        });
      }

      const result = await response.json();

      return res.json({
        success: true,
        transcript: result.text || "",
        engine: "whisper-1",
        metadata: {
          filename: originalname,
          size_bytes: size,
          mimetype: mimetype,
        },
      });
    }

    // ── Fallback: stub response ──
    console.log("[Transcribe] No OPENAI_API_KEY set — returning stub response");

    return res.json({
      success: true,
      transcript: "Schedule a meeting with Sarah next Tuesday at 3pm about the Q4 budget",
      engine: "stub",
      confidence: 0.94,
      language: "en",
      duration_seconds: 4.2,
      metadata: {
        filename: originalname,
        size_bytes: size,
        mimetype: mimetype,
        note: "STUB — Set OPENAI_API_KEY in .env for real Whisper transcription.",
      },
    });
  } catch (error) {
    console.error("[Transcribe] Error:", error.message);
    res.status(500).json({ error: "Transcription failed", details: error.message });
  }
});

module.exports = router;

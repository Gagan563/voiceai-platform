// ============================================
// VoiceAI Platform — ElevenLabs TTS Route
// ============================================

const express = require("express");
const config = require("../config");
const router = express.Router();

/**
 * POST /tts
 *
 * Accepts { text, voiceId } and returns an audio buffer from ElevenLabs API.
 * Falls back to a JSON error if ELEVENLABS_API_KEY is not set.
 */
router.post("/", async (req, res) => {
  try {
    const { text, voiceId } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Missing 'text' field",
        hint: "Send JSON with a 'text' field containing the text to speak.",
      });
    }

    if (voiceId !== undefined && typeof voiceId !== "string") {
      return res.status(400).json({ error: "'voiceId' must be a string" });
    }

    const apiKey = config.ELEVENLABS_API_KEY;
    const selectedVoice = (voiceId || config.ELEVENLABS_VOICE_ID || "").trim();

    if (!selectedVoice) {
      return res.status(400).json({ error: "Missing ElevenLabs voice id" });
    }

    if (!config.isElevenLabsConfigured()) {
      return res.status(503).json({
        error: "ElevenLabs API key not configured",
        hint: "Set ELEVENLABS_API_KEY in your backend .env file. Get a free key at https://elevenlabs.io",
      });
    }

    console.log(`[TTS] Synthesizing ${text.length} chars with voice ${selectedVoice}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoice)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: config.ELEVENLABS_MODEL,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[TTS] ElevenLabs API error:", response.status, errorText);

      if (response.status === 401) {
        return res.status(401).json({
          error: "Invalid ElevenLabs API key",
          hint: "Check your ELEVENLABS_API_KEY in the .env file.",
        });
      }

      return res.status(502).json({
        error: "ElevenLabs TTS failed",
        status: response.status,
        details: errorText,
      });
    }

    // Stream the audio back to the client
    const contentType = response.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache");

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[TTS] Returning ${(buffer.length / 1024).toFixed(1)} KB of audio`);
    res.send(buffer);
  } catch (error) {
    console.error("[TTS] Error:", error.message);
    res.status(500).json({ error: "TTS failed", details: error.message });
  }
});

module.exports = router;

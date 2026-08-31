/**
 * Environment validation — fails fast on missing critical vars in production.
 */
const config = require("../config");

const required = {
  production: ["JWT_SECRET", "DATABASE_URL"],
  development: [],
};

const warnings = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ELEVENLABS_API_KEY",
];

function validateEnv() {
  const env = process.env.NODE_ENV || "development";
  const memoryMode = process.env.VOICEAI_MEMORY_MODE || config.MEMORY_MODE;

  if (env === "production") {
    if (!process.env.DATABASE_URL && memoryMode !== "local") {
      console.warn("⚠️  DATABASE_URL is not set. Operating in local memory fallback mode.");
    }

    if (!process.env.JWT_SECRET) {
      console.warn("⚠️  JWT_SECRET was not provided. An ephemeral 256-bit secret was generated for this instance.");
    } else if (process.env.JWT_SECRET === config.JWT_SECRET_PLACEHOLDER) {
      console.warn("⚠️  JWT_SECRET is set to placeholder value. Using an ephemeral secret instead.");
    } else if (process.env.JWT_SECRET.length < 32) {
      console.warn("⚠️  JWT_SECRET is shorter than 32 characters. Consider using a stronger key.");
    }

    if (config.CONNECTOR_DEMO_MODE) {
      console.warn("⚠️  CONNECTOR_DEMO_MODE is enabled in production. Real connector credentials should be configured.");
    }
    if (config.ALLOW_STUB_TRANSCRIPTION) {
      console.warn("⚠️  ALLOW_STUB_TRANSCRIPTION is enabled in production. Real Whisper credentials should be configured.");
    }
  }

  const missingOptional = warnings.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn("ℹ  Optional keys not set (mock/fallback mode active):");
    missingOptional.forEach((key) => console.warn(`   • ${key}`));
    console.warn("");
  }
}

module.exports = { validateEnv };

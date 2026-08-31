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
  
  let requiredVars = [];
  if (env === "production") {
    requiredVars.push("JWT_SECRET");
    if (memoryMode !== "local") {
      requiredVars.push("DATABASE_URL");
    }
  }
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\n  Missing required environment variables (${env}):`);
    missing.forEach((key) => console.error(`   • ${key}`));

    if (env === "production") {
      console.error("\n   Cannot start in production with missing vars.\n");
      process.exit(1);
    } else {
      console.warn("\n   ⚠  Running in dev mode — some features may not work.\n");
    }
  }

  const missingOptional = warnings.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn("⚠  Optional keys not set (features disabled):");
    missingOptional.forEach((key) => console.warn(`   • ${key}`));
    console.warn("");
  }

  // Validate JWT_SECRET is not the default and meets length in production
  if (env === "production") {
    if (process.env.JWT_SECRET === config.JWT_SECRET_PLACEHOLDER) {
      console.error("❌ JWT_SECRET is still the default placeholder. Set a real secret.");
      process.exit(1);
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.error("❌ JWT_SECRET must be at least 32 characters long in production.");
      process.exit(1);
    }
    if (config.CONNECTOR_DEMO_MODE) {
      console.warn("⚠️  CONNECTOR_DEMO_MODE is enabled in production. Real connector credentials should be configured.");
    }
    if (config.ALLOW_STUB_TRANSCRIPTION) {
      console.warn("⚠️  ALLOW_STUB_TRANSCRIPTION is enabled in production. Real Whisper credentials should be configured.");
    }
  }
}

module.exports = { validateEnv };

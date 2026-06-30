/**
 * Environment validation — fails fast on missing critical vars in production.
 */
const config = require("../config");

const required = {
  production: ["GEMINI_API_KEY", "JWT_SECRET", "DATABASE_URL"],
  development: ["GEMINI_API_KEY"],
};

const warnings = [
  "OPENAI_API_KEY",
  "ELEVENLABS_API_KEY",
];

function validateEnv() {
  const env = process.env.NODE_ENV || "development";
  const requiredVars = required[env] || required.development;
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\n❌  Missing required environment variables (${env}):`);
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

  // Validate JWT_SECRET is not the default in production
  if (
    env === "production" &&
    process.env.JWT_SECRET === config.JWT_SECRET_PLACEHOLDER
  ) {
    console.error("❌  JWT_SECRET is still the default placeholder. Set a real secret.");
    process.exit(1);
  }
}

module.exports = { validateEnv };

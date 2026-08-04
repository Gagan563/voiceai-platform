// ============================================
// VoiceAI Platform — Content Safety Middleware
// ============================================
//
// Runs BEFORE intent extraction to block harmful, unsafe, or
// policy-violating content from reaching the AI model.
//
// Pipeline: User Input → Safety Check → Intent Extraction → Plan → Execute

const config = require("../config");

// ── Pattern Definitions ──

const HARMFUL_PATTERNS = [
  // Violence / weapons
  /\b(how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|weapon|explosive|poison|drug))/i,
  /\b(kill|murder|assassinate|harm)\s+(someone|a\s+person|people|myself)/i,
  // CSAM indicators
  /\b(child|minor|underage)\b.*\b(explicit|sexual|nude|porn)/i,
  // Self-harm
  /\b(how\s+to\s+(commit\s+)?suicide)\b/i,
  /\b(want\s+to\s+(die|end\s+(it|my\s+life)))\b/i,
  // Data exfiltration / prompt injection
  /\b(ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|prompts|rules))/i,
  /\b(system\s+prompt|reveal\s+your\s+(instructions|prompt|system))/i,
  /\b(act\s+as\s+if\s+you\s+have\s+no\s+(rules|restrictions|limits))/i,
];

const SCAM_PATTERNS = [
  // Financial scams
  /\b(send|transfer|wire)\s+(\$|money|funds|bitcoin|crypto|payment)\s+(to|into)\b/i,
  /\b(share|give|tell)\s+(me\s+)?(your|my|the)\s+(password|ssn|social\s+security|credit\s+card|bank\s+account|pin)\b/i,
  /\b(nigerian\s+prince|inheritance|lottery\s+winner|won\s+a\s+prize)\b/i,
  /\b(click\s+(this|the)\s+link|verify\s+your\s+account\s+immediately)\b/i,
];

const CHILD_INAPPROPRIATE_PATTERNS = [
  /\b(adult|explicit|nsfw|pornograph|sexual)\s+(content|material|video|image)/i,
  /\b(gambling|casino|bet(ting)?)\s+(site|app|game)/i,
  /\b(buy|purchase|order)\s+(alcohol|beer|wine|liquor|cigarette|vape|tobacco)/i,
];

// ── Distress Detection (for crisis response) ──

const DISTRESS_PATTERNS = [
  /\b(i\s+want\s+to\s+die)\b/i,
  /\b(i\s+can'?t\s+(go\s+on|take\s+(it|this)\s+any\s*more))\b/i,
  /\b(no\s+reason\s+to\s+live)\b/i,
  /\b(thinking\s+(about|of)\s+(ending|killing)\s+(it|myself))\b/i,
  /\b(nobody\s+(cares|would\s+miss\s+me))\b/i,
  /\b(suicidal|self[\s-]?harm)\b/i,
];

// ── Crisis Lines by Region ──

const CRISIS_LINES = {
  US: "988 Suicide & Crisis Lifeline: Call or text 988",
  UK: "Samaritans: Call 116 123 (free, 24/7)",
  IN: "iCall: 9152987821 | Vandrevala Foundation: 1860-2662-345",
  AU: "Lifeline: 13 11 14",
  CA: "Crisis Services Canada: 1-833-456-4566",
  DEFAULT: "If you are in crisis, please contact your local emergency services or visit findahelpline.com",
};

// ── Safety Check Functions ──

/**
 * Check text against a set of regex patterns.
 * @returns {{ matched: boolean, pattern: string|null }}
 */
function matchPatterns(text, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return { matched: true, pattern: pattern.source };
    }
  }
  return { matched: false, pattern: null };
}

/**
 * Main safety assessment function.
 *
 * @param {string} text — The user's input text
 * @param {object} options
 * @param {boolean} options.parentalControls — Whether parental controls are active
 * @param {string} options.ageGroup — "child" | "teen" | "adult"
 * @returns {{ safe: boolean, reason?: string, category?: string, crisis?: object }}
 */
function assessSafety(text, options = {}) {
  const { parentalControls = false, ageGroup = "adult" } = options;

  if (!text || typeof text !== "string") {
    return { safe: true };
  }

  const normalized = text.trim();
  if (normalized.length < 3) {
    return { safe: true };
  }

  // 1. Check for distress (always check — this triggers help, not blocking)
  const distressCheck = matchPatterns(normalized, DISTRESS_PATTERNS);
  if (distressCheck.matched) {
    return {
      safe: false,
      reason: "Distress detected. Providing crisis resources.",
      category: "distress",
      crisis: {
        detected: true,
        message: "I'm concerned about what you've shared. Please reach out to someone who can help.",
        resources: CRISIS_LINES,
      },
    };
  }

  // 2. Check for harmful content
  const harmfulCheck = matchPatterns(normalized, HARMFUL_PATTERNS);
  if (harmfulCheck.matched) {
    return {
      safe: false,
      reason: "Request contains potentially harmful content.",
      category: "harmful",
    };
  }

  // 3. Check for scam/social-engineering patterns
  const scamCheck = matchPatterns(normalized, SCAM_PATTERNS);
  if (scamCheck.matched) {
    return {
      safe: false,
      reason: "Request matches known scam or social-engineering patterns.",
      category: "scam",
    };
  }

  // 4. Check parental controls (if enabled)
  if (parentalControls && (ageGroup === "child" || ageGroup === "teen")) {
    const childCheck = matchPatterns(normalized, CHILD_INAPPROPRIATE_PATTERNS);
    if (childCheck.matched) {
      return {
        safe: false,
        reason: "This content is not appropriate for your age group.",
        category: "age_restricted",
      };
    }
  }

  return { safe: true };
}

/**
 * Assess the risk level of a request based on content analysis.
 * This supplements the AI's own risk assessment.
 *
 * @param {string} text — The user's input text
 * @returns {"low" | "medium" | "high"}
 */
function assessRiskLevel(text) {
  if (!text) return "low";

  const normalized = text.toLowerCase();

  // High risk: financial, personal data, contacting others
  const highRiskPatterns = [
    /\b(send|transfer|pay|purchase|buy|order|charge|refund)\b/,
    /\b(delete|remove|erase|destroy|wipe)\s+(all|my|the|every)/,
    /\b(share|send|forward|give)\s+(my|the|personal|private)\s+(data|info|details|records)/,
    /\b(call|email|text|message|contact)\s+(someone|him|her|them|my)/,
    /\b(password|credit\s*card|bank|account\s*number|ssn)\b/,
    /\b(install|download|execute|run)\s+(this|the|a)\s+(program|script|file|software)/,
  ];

  for (const pattern of highRiskPatterns) {
    if (pattern.test(normalized)) return "high";
  }

  // Medium risk: creating, scheduling, automating, modifying files
  const mediumRiskPatterns = [
    /\b(schedule|book|reserve|set\s+up|arrange)\b/,
    /\b(create|write|draft|generate|compose)\s+(a|an|the|my)/,
    /\b(automate|set\s+up\s+a\s+routine|recurring)\b/,
    /\b(modify|edit|update|change)\s+(the|my|a)\s+(file|document|code)/,
    /\b(deploy|publish|push|release)\b/,
  ];

  for (const pattern of mediumRiskPatterns) {
    if (pattern.test(normalized)) return "medium";
  }

  // Everything else is low risk
  return "low";
}

// ── Express Middleware ──

/**
 * Express middleware that checks incoming requests for safety before
 * they reach the intent extraction or chat routes.
 *
 * Attaches `req.safety` with the assessment result.
 * Blocks unsafe requests with a 422 response (unless it's a distress case,
 * which gets a compassionate response with resources).
 */
function safetyMiddleware(req, res, next) {
  if (!config.CONTENT_MODERATION_ENABLED) {
    req.safety = { safe: true, riskLevel: "low" };
    return next();
  }

  // Extract text from various request body formats
  const text = req.body?.text || req.body?.message || req.body?.input || "";

  if (!text || typeof text !== "string") {
    req.safety = { safe: true, riskLevel: "low" };
    return next();
  }

  const parentalControls = config.PARENTAL_CONTROLS_ENABLED ||
    req.body?.parentalControls === true;
  const ageGroup = config.PARENTAL_CONTROLS_AGE_GROUP ||
    req.body?.ageGroup || "adult";

  const assessment = assessSafety(text, { parentalControls, ageGroup });
  const riskLevel = assessRiskLevel(text);

  req.safety = {
    ...assessment,
    riskLevel,
  };

  if (!assessment.safe) {
    // Distress case: return crisis resources with a 200 (not an error)
    if (assessment.category === "distress") {
      return res.status(200).json({
        success: true,
        safety_flagged: true,
        category: "distress",
        message: assessment.crisis.message,
        crisis_resources: assessment.crisis.resources,
        spoken_response: `${assessment.crisis.message} ${CRISIS_LINES.DEFAULT}`,
      });
    }

    // Other unsafe content: block with explanation
    console.warn(`[Safety] Blocked request — category: ${assessment.category}`);
    return res.status(422).json({
      success: false,
      safety_flagged: true,
      category: assessment.category,
      message: assessment.reason,
      spoken_response: "I'm not able to help with that request. Let me know if there's something else I can assist with.",
    });
  }

  next();
}

module.exports = {
  safetyMiddleware,
  assessSafety,
  assessRiskLevel,
  CRISIS_LINES,
};

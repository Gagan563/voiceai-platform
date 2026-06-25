/**
 * Input sanitization middleware — strips dangerous patterns from request bodies.
 * Prevents XSS and basic injection attacks.
 */

const DANGEROUS_PATTERNS = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,
  /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
  /<object\b[^>]*>[\s\S]*?<\/object>/gi,
  /<embed\b[^>]*>/gi,
];

function sanitizeString(str) {
  if (typeof str !== "string") return str;

  let clean = str;
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, "");
  }

  // NOTE: We intentionally do NOT HTML-entity-encode < > & here.
  // This middleware runs on AI prompt text, and encoding would corrupt
  // the natural language sent to intent extraction and plan generation.

  return clean;
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  if (typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[sanitizeString(key)] = sanitizeObject(value);
    }
    return result;
  }

  return obj;
}

function sanitizeMiddleware(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }

  next();
}

module.exports = { sanitizeMiddleware, sanitizeString, sanitizeObject };

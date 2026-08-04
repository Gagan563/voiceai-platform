const zlib = require("zlib");

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".json", ".csv", ".yaml", ".yml"]);

function extensionFromName(filename = "") {
  const clean = String(filename).toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot) : "";
}

function xmlDecode(value = "") {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid DOCX archive.");
}

function readZipEntry(buffer, wantedName) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid DOCX central directory.");
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + filenameLength);

    if (name === wantedName) {
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error("Invalid DOCX local file header.");
      }

      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) return compressed;
      if (method === 8) return zlib.inflateRawSync(compressed);
      throw new Error("Unsupported DOCX compression method.");
    }

    offset += 46 + filenameLength + extraLength + commentLength;
  }

  throw new Error(`DOCX entry not found: ${wantedName}`);
}

function extractDocxText(buffer) {
  const xml = readZipEntry(buffer, "word/document.xml").toString("utf8");
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .match(/<w:t(?:\s[^>]*)?>([\\s\\S]*?)<\/w:t>/g)
    ?.map((token) => xmlDecode(token.replace(/<[^>]+>/g, "")))
    .join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim() || "";
}

function extractPlainText(buffer) {
  return buffer
    .toString("utf8")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

/**
 * Extract text from a PDF buffer.
 * Tries to load pdf-parse at runtime; falls back to a basic binary text
 * extraction if the dependency is not installed.
 */
async function extractPdfText(buffer) {
  try {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return (data.text || "").trim();
  } catch {
    // Fallback: extract printable strings from the raw PDF buffer.
    // This is lossy but better than failing entirely.
    const raw = buffer.toString("latin1");
    const strings = raw.match(/[\x20-\x7E]{8,}/g) || [];
    const text = strings.join(" ").replace(/\s{2,}/g, " ").trim();
    if (!text) throw new Error("PDF extraction failed. Install pdf-parse for full support: npm i pdf-parse");
    return text;
  }
}

function summarizeRequirements(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  return sentences.slice(0, 5).join(" ").slice(0, 1200);
}

function buildRequirementPrompt({ filename, text }) {
  const clipped = String(text || "").slice(0, 18000);
  return [
    `Requirements file: ${filename}`,
    "",
    "Read this specification and create an implementation plan for the current NOVA project.",
    "Prioritize missing product requirements, backend/frontend work, data models, safety checks, and verification steps.",
    "",
    clipped,
  ].join("\n");
}

async function extractDocument({ buffer, filename, mimetype }) {
  const ext = extensionFromName(filename);
  let text;
  let kind;

  if (ext === ".pdf" || mimetype === "application/pdf") {
    text = await extractPdfText(buffer);
    kind = "pdf";
  } else if (ext === ".docx" || mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    text = extractDocxText(buffer);
    kind = "docx";
  } else if (TEXT_EXTENSIONS.has(ext) || mimetype?.startsWith("text/")) {
    text = extractPlainText(buffer);
    kind = ext.replace(".", "") || "text";
  } else {
    throw new Error("Unsupported document type. Upload PDF, DOCX, TXT, Markdown, JSON, CSV, YAML, or YML.");
  }

  if (!text) {
    throw new Error("No readable text found in document.");
  }

  return {
    filename,
    kind,
    characters: text.length,
    summary: summarizeRequirements(text),
    text,
    prompt: buildRequirementPrompt({ filename, text }),
  };
}

/**
 * Extract document text and use AI to produce a structured phased
 * implementation plan.
 *
 * Returns: { document, requirements[], phases[] }
 *   - requirements: list of { title, description, priority }
 *   - phases: list of { phase, title, description, tasks[] }
 */
async function extractAndPlan({ buffer, filename, mimetype }) {
  const document = await extractDocument({ buffer, filename, mimetype });

  let ai;
  try {
    ai = require("./ai");
  } catch {
    // AI service not available — return document without structured plan.
    return { document, requirements: [], phases: [] };
  }

  if (!ai.isAvailable()) {
    return { document, requirements: [], phases: [] };
  }

  const systemPrompt = `You are a senior product engineer. Given a product specification or requirements document, extract:
1. A flat list of requirements (each with title, description, and priority: high/medium/low).
2. A phased implementation plan with milestones. Each phase has a title, description, and list of task strings.

Return ONLY valid JSON in this shape:
{
  "requirements": [{ "title": "...", "description": "...", "priority": "high|medium|low" }],
  "phases": [{ "phase": 1, "title": "...", "description": "...", "tasks": ["..."] }]
}

Be practical and concise. Limit to 20 requirements and 6 phases max.`;

  try {
    const result = await ai.chatJSON(
      systemPrompt,
      document.text.slice(0, 16000),
      { task: "review", maxTokens: 4096, temperature: 0.2 }
    );

    return {
      document,
      requirements: Array.isArray(result.requirements) ? result.requirements : [],
      phases: Array.isArray(result.phases) ? result.phases : [],
    };
  } catch (error) {
    console.warn("[Document] AI plan extraction failed:", error.message);
    return { document, requirements: [], phases: [] };
  }
}

module.exports = { extractDocument, extractDocxText, extractPdfText, extractAndPlan };


// ============================================
// VoiceAI Platform - AI Router
// ============================================
//
// Hybrid cost router with provider circuit breakers. The public API remains
// chat(), chatMultiTurn(), chatJSON(), isAvailable(), and getModel().

const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");
const mockAI = require("./mockAI");

const CIRCUIT_FAILURE_LIMIT = config.AI_CIRCUIT_FAILURE_LIMIT;
const CIRCUIT_RESET_MS = config.AI_CIRCUIT_RESET_MS;

const breakers = new Map();
let geminiClient = null;
let geminiModel = null;

function breakerFor(provider) {
  if (!breakers.has(provider)) {
    breakers.set(provider, { failures: 0, openedAt: 0, lastError: null });
  }
  return breakers.get(provider);
}

function isCircuitOpen(provider) {
  const breaker = breakerFor(provider);
  if (!breaker.openedAt) return false;

  if (Date.now() - breaker.openedAt > CIRCUIT_RESET_MS) {
    breaker.openedAt = 0;
    breaker.failures = 0;
    return false;
  }

  return true;
}

function recordSuccess(provider) {
  const breaker = breakerFor(provider);
  breaker.failures = 0;
  breaker.openedAt = 0;
  breaker.lastError = null;
}

function recordFailure(provider, error) {
  const breaker = breakerFor(provider);
  breaker.failures += 1;
  breaker.lastError = error.message;
  if (breaker.failures >= CIRCUIT_FAILURE_LIMIT) {
    breaker.openedAt = Date.now();
  }
}

function providerStatus() {
  return Object.fromEntries(
    ["groq", "gemini", "anthropic"].map((provider) => {
      const breaker = breakerFor(provider);
      return [
        provider,
        {
          configured: isProviderConfigured(provider),
          circuit_open: isCircuitOpen(provider),
          failures: breaker.failures,
          last_error: breaker.lastError,
        },
      ];
    })
  );
}

function isProviderConfigured(provider) {
  if (provider === "groq") {
    return Boolean(config.GROQ_API_KEY && config.GROQ_API_KEY.length > 10);
  }
  if (provider === "gemini") {
    return Boolean(config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 10);
  }
  if (provider === "anthropic") {
    return Boolean(config.ANTHROPIC_API_KEY && config.ANTHROPIC_API_KEY.length > 10);
  }
  return false;
}

function providerOrder(options = {}) {
  if (options.provider) return [options.provider];

  const mode = config.AI_ROUTER_MODE;

  // Single-provider modes: force one provider as primary with ordered fallbacks.
  if (mode === "groq") return ["groq", "gemini", "anthropic"];
  if (mode === "gemini") return ["gemini", "groq", "anthropic"];
  if (mode === "anthropic") return ["anthropic", "groq", "gemini"];

  // Hybrid mode (default): route by task complexity.
  // - Deep reasoning (agent, code, large context) → Gemini primary, Anthropic secondary
  // - Fast/cheap tasks (chat, intent, review)     → Groq primary, Gemini secondary
  // - Anthropic is always the final fallback
  const task = options.task || "general";
  const needsDeepReasoning = task === "agent" || task === "code" || options.maxTokens > 4096;
  return needsDeepReasoning
    ? ["gemini", "anthropic", "groq"]
    : ["groq", "gemini", "anthropic"];
}

function getGeminiModel() {
  if (geminiModel) return geminiModel;

  const apiKey = config.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    throw new Error("GEMINI_API_KEY not configured in .env");
  }

  geminiClient = new GoogleGenerativeAI(apiKey);
  geminiModel = geminiClient.getGenerativeModel({
    model: config.GEMINI_MODEL,
  });
  return geminiModel;
}

async function callGemini(systemPrompt, userMessage, options = {}) {
  const model = getGeminiModel();
  const generationConfig = {
    maxOutputTokens: options.maxTokens || config.DEFAULT_MAX_TOKENS.chat,
    temperature: options.temperature ?? 0.7,
  };

  if (options.json) {
    generationConfig.responseMimeType = "application/json";
  }

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig,
  });

  return result.response.text();
}

async function callGeminiImage(systemPrompt, image, prompt, options = {}) {
  const model = getGeminiModel();
  const generationConfig = {
    maxOutputTokens: options.maxTokens || config.DEFAULT_MAX_TOKENS.stream,
    temperature: options.temperature ?? 0.3,
  };

  if (options.json) {
    generationConfig.responseMimeType = "application/json";
  }

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: image.mimeType,
              data: image.data,
            },
          },
        ],
      },
    ],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig,
  });

  return result.response.text();
}

async function callGeminiMultiTurn(systemPrompt, messages, options = {}) {
  const model = getGeminiModel();
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === "assistant" || msg.role === "model" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
  const generationConfig = {
    maxOutputTokens: options.maxTokens || config.DEFAULT_MAX_TOKENS.multiTurn,
    temperature: options.temperature ?? 0.7,
  };

  const chatSession = model.startChat({
    history,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig,
  });

  const lastMessage = messages[messages.length - 1];
  const result = await chatSession.sendMessage(lastMessage.content);
  return result.response.text();
}

async function callGroq(systemPrompt, userMessage, options = {}) {
  return callGroqMessages(
    systemPrompt,
    [{ role: "user", content: userMessage }],
    options
  );
}

async function callGroqMultiTurn(systemPrompt, messages, options = {}) {
  return callGroqMessages(systemPrompt, messages, {
    ...options,
    maxTokens: options.maxTokens || config.DEFAULT_MAX_TOKENS.multiTurn,
  });
}

async function callGroqMessages(systemPrompt, messages, options = {}) {
  const apiKey = config.GROQ_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    throw new Error("GROQ_API_KEY not configured in .env");
  }

  const body = {
    model: options.model || config.GROQ_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((msg) => ({
        role: msg.role === "assistant" || msg.role === "model" ? "assistant" : "user",
        content: msg.content,
      })),
    ],
    max_tokens: options.maxTokens || config.DEFAULT_MAX_TOKENS.chat,
    temperature: options.temperature ?? 0.7,
  };

  if (options.json) {
    body.response_format = { type: "json_object" };
  }

  const endpoint = `${config.GROQ_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const groqFetch = async (requestBody) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.GROQ_TIMEOUT_MS);
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`Groq request timed out after ${config.GROQ_TIMEOUT_MS}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  const isJsonModeRejected = (status, errorText) =>
    status === 400 &&
    /response_format|json|schema/i.test(String(errorText || ""));

  let response = await groqFetch(body);

  if (!response.ok) {
    const originalErrorText = await response.text();
    const originalStatus = response.status;

    // Retry without response_format if the provider rejected JSON mode.
    if (options.json && body.response_format && isJsonModeRejected(originalStatus, originalErrorText)) {
      const fallbackBody = { ...body };
      delete fallbackBody.response_format;
      const retryResponse = await groqFetch(fallbackBody);
      if (retryResponse.ok) {
        const data = await retryResponse.json();
        return data.choices?.[0]?.message?.content?.trim() || "";
      }
      const retryErrorText = await retryResponse.text();
      throw new Error(
        `Groq request failed: ${originalStatus} ${originalErrorText} | ` +
        `Retry without JSON mode also failed: ${retryResponse.status} ${retryErrorText}`
      );
    }
    throw new Error(`Groq request failed: ${originalStatus} ${originalErrorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callAnthropic(systemPrompt, userMessage, options = {}) {
  const apiKey = config.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    throw new Error("ANTHROPIC_API_KEY not configured in .env");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": config.ANTHROPIC_API_VERSION,
    },
    body: JSON.stringify({
      model: options.model || config.ANTHROPIC_MODEL,
      max_tokens: options.maxTokens || config.DEFAULT_MAX_TOKENS.chat,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return (data.content || [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

async function callAnthropicMultiTurn(systemPrompt, messages, options = {}) {
  const apiKey = config.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    throw new Error("ANTHROPIC_API_KEY not configured in .env");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": config.ANTHROPIC_API_VERSION,
    },
    body: JSON.stringify({
      model: options.model || config.ANTHROPIC_MODEL,
      max_tokens: options.maxTokens || config.DEFAULT_MAX_TOKENS.multiTurn,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role === "assistant" || msg.role === "model" ? "assistant" : "user",
        content: msg.content,
      })),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return (data.content || [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

async function routeCall(callType, systemPrompt, payload, options = {}) {
  const errors = [];

  for (const provider of providerOrder(options)) {
    if (!isProviderConfigured(provider)) {
      errors.push(`${provider}: not configured`);
      continue;
    }
    if (isCircuitOpen(provider)) {
      errors.push(`${provider}: circuit open`);
      continue;
    }

    try {
      let text;
      if (provider === "groq") {
        text =
          callType === "multi"
            ? await callGroqMultiTurn(systemPrompt, payload, options)
            : await callGroq(systemPrompt, payload, options);
      } else if (provider === "gemini") {
        text =
          callType === "multi"
            ? await callGeminiMultiTurn(systemPrompt, payload, options)
            : await callGemini(systemPrompt, payload, options);
      } else {
        text =
          callType === "multi"
            ? await callAnthropicMultiTurn(systemPrompt, payload, options)
            : await callAnthropic(systemPrompt, payload, options);
      }
      recordSuccess(provider);
      return text;
    } catch (error) {
      recordFailure(provider, error);
      errors.push(`${provider}: ${error.message}`);
    }
  }

  // ── Mock AI fallback — no real provider available ──
  console.log("[AI] All providers unavailable, using mock AI fallback");
  if (callType === "multi") {
    return mockAI.chatMultiTurn(systemPrompt, payload);
  }
  return mockAI.chat(systemPrompt, payload);
}

async function chat(systemPrompt, userMessage, options = {}) {
  return routeCall("single", systemPrompt, userMessage, options);
}

async function chatMultiTurn(systemPrompt, messages, options = {}) {
  return routeCall("multi", systemPrompt, messages, options);
}

async function chatJSON(systemPrompt, userMessage, options = {}) {
  // If no real provider is available, use mock AI directly for JSON
  if (!hasRealProvider()) {
    return mockAI.chatJSON(systemPrompt, userMessage);
  }

  const text = await routeCall("single", systemPrompt, userMessage, {
    ...options,
    json: true,
    temperature: options.temperature ?? 0.3,
  });

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);

    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);

    throw new Error(`Failed to parse AI JSON response: ${text.substring(0, 100)}`);
  }
}

async function chatImage(systemPrompt, image, prompt, options = {}) {
  if (!isProviderConfigured("gemini") || isCircuitOpen("gemini")) {
    // Fall back to mock vision
    return mockAI.chatImage(systemPrompt, image, prompt);
  }

  try {
    const text = await callGeminiImage(systemPrompt, image, prompt, options);
    recordSuccess("gemini");
    return text;
  } catch (error) {
    recordFailure("gemini", error);
    // Fall back to mock vision instead of throwing
    return mockAI.chatImage(systemPrompt, image, prompt);
  }
}

/**
 * Check if any real AI provider is configured and available.
 */
function hasRealProvider() {
  return ["groq", "gemini", "anthropic"].some(
    (provider) => isProviderConfigured(provider) && !isCircuitOpen(provider)
  );
}

/**
 * Always returns true — mock AI is always available as fallback.
 */
function isAvailable() {
  return true;
}

/**
 * Stream a response from Gemini, yielding text chunks as they arrive.
 * Returns an async generator of text strings.
 */
async function* callGeminiStream(systemPrompt, userMessage, options = {}) {
  const model = getGeminiModel();
  const generationConfig = {
    maxOutputTokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.5,
  };

  const result = await model.generateContentStream({
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig,
  });

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/**
 * Stream a multi-turn conversation response from Gemini.
 */
async function* callGeminiMultiTurnStream(systemPrompt, messages, options = {}) {
  const model = getGeminiModel();
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === "assistant" || msg.role === "model" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
  const generationConfig = {
    maxOutputTokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.5,
  };

  const chatSession = model.startChat({
    history,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig,
  });

  const lastMessage = messages[messages.length - 1];
  const result = await chatSession.sendMessageStream(lastMessage.content);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

/**
 * Stream a chat response. Returns an async generator of text chunks.
 * Falls back to a single-yield non-streaming call if streaming is unavailable.
 */
async function* chatStream(systemPrompt, userMessage, options = {}) {
  const provider = providerOrder(options).find(
    (p) => isProviderConfigured(p) && !isCircuitOpen(p)
  );

  if (!provider) {
    // Use mock AI streaming fallback
    for await (const chunk of mockAI.chatStream(systemPrompt, userMessage)) {
      yield chunk;
    }
    return;
  }

  if (provider === "gemini") {
    try {
      for await (const chunk of callGeminiStream(systemPrompt, userMessage, options)) {
        yield chunk;
      }
      recordSuccess("gemini");
      return;
    } catch (error) {
      recordFailure("gemini", error);
      // Fall through to non-streaming fallback
    }
  }

  // Fallback: non-streaming call wrapped as single chunk
  const text = await routeCall("single", systemPrompt, userMessage, options);
  yield text;
}

/**
 * Conversational multi-turn chat. Accepts an array of { role, content } messages.
 * Supports streaming via async generator.
 */
async function* chatConversationalStream(systemPrompt, messages, options = {}) {
  const provider = providerOrder(options).find(
    (p) => isProviderConfigured(p) && !isCircuitOpen(p)
  );

  if (!provider) {
    // Use mock AI conversational streaming fallback
    for await (const chunk of mockAI.chatConversationalStream(systemPrompt, messages)) {
      yield chunk;
    }
    return;
  }

  if (provider === "gemini") {
    try {
      for await (const chunk of callGeminiMultiTurnStream(systemPrompt, messages, options)) {
        yield chunk;
      }
      recordSuccess("gemini");
      return;
    } catch (error) {
      recordFailure("gemini", error);
    }
  }

  // Fallback: non-streaming multi-turn
  const text = await routeCall("multi", systemPrompt, messages, options);
  yield text;
}

/**
 * Non-streaming conversational multi-turn chat. Returns full text.
 */
async function chatConversational(systemPrompt, messages, options = {}) {
  return routeCall("multi", systemPrompt, messages, options);
}

module.exports = {
  chat,
  chatMultiTurn,
  chatJSON,
  chatImage,
  chatStream,
  chatConversational,
  chatConversationalStream,
  isAvailable,
  getModel: getGeminiModel,
  providerStatus,
};

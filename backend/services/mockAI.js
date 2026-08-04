// ============================================
// NOVA VoiceAI Platform — Mock AI Service
// ============================================
//
// A complete local AI fallback that provides intelligent deterministic
// responses for all AI functions. Zero API calls — everything runs locally.
//
// Used automatically when no real AI provider (Gemini/Groq/Anthropic) is
// configured. Provides enough functionality to demo and develop the full
// platform end-to-end.

/**
 * Detect intent from text — mirrors the AI-powered intent extraction.
 */
function detectActionType(text = "") {
  const value = text.toLowerCase();
  if (/(schedule|meeting|calendar|appointment|book|invite)/.test(value)) return "schedule";
  if (/(remind|reminder|remember to|don't forget|nudge)/.test(value)) return "remind";
  if (/(search|find|look up|google|news|research)/.test(value)) return "search";
  if (/(email|send|message|text|mail|reply|draft)/.test(value)) return "message";
  if (/(translate|translation|language|phrase)/.test(value)) return "translate";
  if (/(turn on|turn off|control|thermostat|light|device)/.test(value)) return "control";
  if (
    /(build|create|generate|make|develop)/.test(value) &&
    /(platform|app|website|dashboard|requirements|prd|spec|prototype|page|site|game)/.test(value)
  ) {
    return "create";
  }
  if (/(write|draft|compose|essay|blog|post)/.test(value)) return "create";
  if (/(health|symptom|medicine|mood|exercise|bmi|calorie)/.test(value)) return "health";
  if (/(finance|expense|income|budget|spending|money)/.test(value)) return "finance";
  if (/(learn|quiz|flashcard|teach|study|explain|homework)/.test(value)) return "learn";
  if (/(travel|trip|itinerary|flight|hotel|packing)/.test(value)) return "travel";
  if (/(music|movie|tv|book|podcast|spotify|news)/.test(value)) return "media";
  return "answer";
}

function detectModule(text = "") {
  const value = text.toLowerCase();
  if (/(health|symptom|medicine|medication|water|sleep|mood|exercise|bmi|calorie|doctor)/.test(value)) return "health";
  if (/(finance|expense|income|budget|spending|bill|currency|money|invoice)/.test(value)) return "finance";
  if (/(learn|lesson|quiz|flashcard|teach|study|explain|homework)/.test(value)) return "learn";
  if (/(home assistant|smart home|light|thermostat|room|device|scene)/.test(value)) return "home";
  if (/(travel|trip|itinerary|flight|hotel|visa|packing|destination|weather)/.test(value)) return "travel";
  if (/(music|movie|tv|book|podcast|youtube|spotify|news|entertainment)/.test(value)) return "media";
  if (/(translate|translation|language|phrase|pronunciation)/.test(value)) return "translate";
  if (/(business|meeting summary|crm|contact|report|csv|data analysis|proposal)/.test(value)) return "business";
  if (/(write|draft|email|essay|blog|post|cover letter|content|generate code)/.test(value)) return "write";
  if (/(search|research|find|look up|source|latest)/.test(value)) return "search";
  if (/(task|schedule|meeting|remind|reminder|calendar|checklist)/.test(value)) return "task";
  if (
    /(build|create|make|generate|develop)/.test(value) &&
    /(app|website|dashboard|preview|prototype|page|site|game)/.test(value)
  ) {
    return "write";
  }
  return "chat";
}

function extractEntities(text = "") {
  const value = text.toLowerCase();
  const entities = { time: null, person: null, location: null, topic: null, amount: null, language: null };

  // Time extraction
  const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/);
  if (timeMatch) entities.time = timeMatch[1];
  if (/(tomorrow|today|tonight|morning|afternoon|evening|next week|next month)/.test(value)) {
    entities.time = entities.time || value.match(/(tomorrow|today|tonight|morning|afternoon|evening|next week|next month)/)?.[0];
  }

  // Person extraction
  const personMatch = text.match(/(?:with|for|to|from|contact|call|email|meet)\s+(\w+)/i);
  if (personMatch) entities.person = personMatch[1];

  // Location
  const locationMatch = text.match(/(?:in|at|to|from)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  if (locationMatch) entities.location = locationMatch[1];

  // Amount
  const amountMatch = text.match(/(\$?\d+(?:,\d{3})*(?:\.\d{2})?)/);
  if (amountMatch) entities.amount = amountMatch[1];

  // Topic — use the main subject
  entities.topic = text.replace(/^(please|can you|could you|i want to|i need to|help me)\s*/i, "").trim();

  // Language for translation
  const langMatch = text.match(/(?:to|in|into)\s+(hindi|spanish|french|german|chinese|japanese|korean|arabic|portuguese|russian|italian|dutch|turkish)/i);
  if (langMatch) entities.language = langMatch[1];

  return entities;
}

/**
 * Generate a mock intent extraction response.
 */
function mockIntentExtraction(text) {
  const goal = text.trim().replace(/[.?!]+$/, "") || "Help with a NOVA request";
  const actionType = detectActionType(text);
  const module = detectModule(text);
  const entities = extractEntities(text);
  const confidence = 0.82 + Math.random() * 0.15;

  const spokenResponses = {
    schedule: `Sure, I can help with scheduling. I'll set up the details for ${goal} and let you know if anything's missing.`,
    remind: `Got it. I'll save that reminder and make sure it's tracked properly.`,
    search: `I'll look into that and pull together the most useful results.`,
    create: `I see what you're going for. Let me shape this into something practical.`,
    answer: `Good question. Let me put together a clear answer for you.`,
    control: `I'll check that and handle it carefully.`,
    translate: `I can help with that translation. Let me work on it.`,
    message: `I'll draft that for you and show it before sending.`,
    health: `I'll look into that health question and give you practical guidance.`,
    finance: `I can help track that. Let me organize the financial details.`,
    learn: `Great learning topic. I'll prepare something useful for you.`,
    travel: `I'll help plan that out with practical details.`,
    media: `Let me find that for you.`,
  };

  return {
    goal,
    module,
    action_type: actionType,
    entities,
    steps: generateStepDescriptions(actionType, goal),
    constraints: [],
    missing_info: [],
    confidence: Number(confidence.toFixed(2)),
    spoken_response: spokenResponses[actionType] || `I understand. I'll handle ${goal} in the most practical way I can.`,
  };
}

function generateStepDescriptions(actionType, goal) {
  const templates = {
    schedule: ["Check calendar for conflicts", "Create the event", "Send invites if needed"],
    remind: ["Create the reminder", "Schedule the notification"],
    search: [`Search for "${goal}"`, "Summarize the most relevant results"],
    create: ["Analyze the requirements", "Design the structure", "Generate the output", "Validate the result"],
    answer: ["Understand the question", "Provide a clear answer"],
    control: ["Check device status", "Execute the control command", "Confirm the result"],
    translate: ["Detect source language", "Translate the text", "Show the result"],
    message: ["Draft the message", "Review before sending"],
    health: ["Analyze the health query", "Provide practical guidance"],
    finance: ["Review the financial data", "Prepare the summary"],
    learn: ["Prepare the learning content", "Present it clearly"],
    travel: ["Research the destination", "Organize the details"],
    media: ["Search the catalog", "Present the results"],
  };
  return templates[actionType] || ["Understand the request", "Prepare the result", "Show the output"];
}

/**
 * Generate a mock execution plan from intent.
 */
function mockPlanGeneration(intentText) {
  let intent;
  try {
    intent = typeof intentText === "string" ? JSON.parse(intentText) : intentText;
  } catch {
    intent = { goal: String(intentText), action_type: "answer" };
  }

  const actionType = intent.action_type || "answer";
  const goal = intent.goal || "Complete the request";

  const planTemplates = {
    schedule: [
      { step: 1, action: "check_availability", description: "Check your calendar for conflicts", service: "calendar", requires_input: false, estimated_duration_seconds: 2, fallback: "Assume the time slot is free" },
      { step: 2, action: "create_event", description: `Create a calendar event for "${goal}"`, service: "calendar", requires_input: false, estimated_duration_seconds: 3, fallback: "Save as a reminder instead" },
      { step: 3, action: "send_invites", description: "Send invites to relevant people", service: "email", requires_input: false, estimated_duration_seconds: 2, fallback: "Skip invites and notify later" },
    ],
    remind: [
      { step: 1, action: "create_reminder", description: `Create a reminder: "${goal}"`, service: "notification", requires_input: false, estimated_duration_seconds: 1, fallback: "Save locally" },
      { step: 2, action: "schedule_notification", description: "Schedule the notification at the right time", service: "notification", requires_input: false, estimated_duration_seconds: 1, fallback: "Use default timing" },
    ],
    search: [
      { step: 1, action: "web_search", description: `Search the web for "${goal}"`, service: "web", requires_input: false, estimated_duration_seconds: 3, fallback: "Use cached results" },
      { step: 2, action: "summarize_results", description: "Summarize the most relevant results", service: "ai", requires_input: false, estimated_duration_seconds: 2, fallback: "Show raw results" },
    ],
    create: [
      { step: 1, action: "analyze_requirements", description: `Define the scope for: ${goal}`, service: "ai", requires_input: false, estimated_duration_seconds: 3, fallback: "Use sensible defaults" },
      { step: 2, action: "generate_output", description: "Generate the requested content", service: "ai", requires_input: false, estimated_duration_seconds: 5, fallback: "Create a simpler version" },
      { step: 3, action: "validate_result", description: "Validate the output quality", service: "ai", requires_input: false, estimated_duration_seconds: 2, fallback: "Show the output for manual review" },
    ],
    answer: [
      { step: 1, action: "understand_question", description: `Understand: "${goal}"`, service: "ai", requires_input: false, estimated_duration_seconds: 1, fallback: "Ask for clarification" },
      { step: 2, action: "provide_answer", description: "Provide a clear, practical answer", service: "ai", requires_input: false, estimated_duration_seconds: 2, fallback: "Offer related information" },
    ],
    control: [
      { step: 1, action: "check_device", description: "Check device status", service: "device", requires_input: false, estimated_duration_seconds: 2, fallback: "Report device as offline" },
      { step: 2, action: "execute_command", description: `Execute: ${goal}`, service: "device", requires_input: false, estimated_duration_seconds: 1, fallback: "Queue the command for retry" },
    ],
  };

  return planTemplates[actionType] || planTemplates.answer;
}

/**
 * Generate a contextual chat response.
 */
function mockChatResponse(systemPrompt, userMessage) {
  const text = String(userMessage || "").toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)\b/.test(text)) {
    return "Hey! I'm NOVA, your AI workspace. Tell me what you want done — I can schedule, search, draft, build, remind, and a lot more. What's on your mind?";
  }

  // Thanks
  if (/^(thanks|thank you|thx|cheers|appreciate it)/.test(text)) {
    return "Of course! I'm right here when you need me.";
  }

  // Who are you
  if (/(who are you|what are you|what can you do|help me|what do you do)/.test(text)) {
    return "I'm NOVA — a voice-first AI workspace. I can help you schedule meetings, search the web, draft emails, track expenses, manage tasks, build apps, translate text, and much more. Just tell me what you need in plain language.";
  }

  // Weather
  if (/(weather|temperature|forecast|rain|sunny|cloudy)/.test(text)) {
    return "I'd need your location to check the weather. Which city should I look up?";
  }

  // Math/calculations
  const mathMatch = text.match(/(?:what is|calculate|compute|how much is)\s*([\d+\-*/().%\s]+)/i);
  if (mathMatch) {
    try {
      // Only evaluate safe math expressions
      const expr = mathMatch[1].trim();
      if (/^[\d+\-*/().%\s]+$/.test(expr)) {
        const result = Function(`"use strict"; return (${expr})`)();
        return `That's ${result}.`;
      }
    } catch {
      // Fall through to general response
    }
  }

  // Time
  if (/(what time|current time|what's the time)/.test(text)) {
    return `It's ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}. Anything you need to schedule?`;
  }

  // Date
  if (/(what date|today's date|what day|what is today)/.test(text)) {
    return `Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
  }

  // Explain something
  if (/^(explain|what is|define|tell me about|describe)\b/.test(text)) {
    const topic = text.replace(/^(explain|what is|define|tell me about|describe)\s*/i, "").replace(/[?.]$/, "").trim();
    if (topic) {
      return `${topic.charAt(0).toUpperCase() + topic.slice(1)} is an interesting topic. In a full setup with an AI provider configured, I'd give you a detailed explanation. For now, I'm running in local mode — add a Gemini or Groq API key in Settings to unlock full AI responses.`;
    }
  }

  // Jokes
  if (/(joke|funny|make me laugh|humor)/.test(text)) {
    const jokes = [
      "Why do programmers prefer dark mode? Because light attracts bugs.",
      "I told my computer I needed a break, and now it won't stop sending me Kit-Kat ads.",
      "There are only 10 types of people: those who understand binary and those who don't.",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  // Default contextual response
  const topic = text.replace(/^(please|can you|could you|i want to|help me)\s*/i, "").trim();
  return `I hear you. "${topic}" — I've processed this locally. With an AI provider configured (Gemini, Groq, or Anthropic), I'd give you a much richer response. You can add your API key in Settings to unlock full capabilities.`;
}

/**
 * Generate a mock JSON response based on the system prompt context.
 */
function mockChatJSON(systemPrompt, userMessage) {
  const prompt = String(systemPrompt || "").toLowerCase();
  const text = String(userMessage || "");

  // Intent extraction
  if (prompt.includes("intent extraction") || prompt.includes("extract") && prompt.includes("intent")) {
    return mockIntentExtraction(text);
  }

  // Plan generation
  if (prompt.includes("planning layer") || prompt.includes("execution plan") || prompt.includes("plan generation")) {
    return mockPlanGeneration(text);
  }

  // Review
  if (prompt.includes("review") && (prompt.includes("execution") || prompt.includes("result"))) {
    return {
      status: "passed",
      confidence: 0.85,
      summary: "All executable steps completed successfully. Running in local mode.",
      issues: [],
      corrections: [],
    };
  }

  // Fact extraction / memory
  if (prompt.includes("extract") && (prompt.includes("memories") || prompt.includes("facts"))) {
    return [];
  }

  // Conversation router
  if (prompt.includes("classify") && prompt.includes("route")) {
    return {
      route: "direct",
      reason: "Local mode — routing directly",
      suggested_response: mockChatResponse(systemPrompt, text),
    };
  }

  // Document plan extraction
  if (prompt.includes("requirements") && prompt.includes("phases")) {
    return {
      requirements: [
        { title: "Core functionality", description: "Implement the main features described in the document", priority: "high" },
        { title: "User interface", description: "Create a clean, responsive UI", priority: "high" },
        { title: "Testing", description: "Add comprehensive test coverage", priority: "medium" },
      ],
      phases: [
        { phase: 1, title: "Foundation", description: "Set up core architecture", tasks: ["Initialize project", "Set up database", "Create API endpoints"] },
        { phase: 2, title: "Features", description: "Build main features", tasks: ["Implement core logic", "Create UI components", "Add integrations"] },
        { phase: 3, title: "Polish", description: "Test and deploy", tasks: ["Write tests", "Fix bugs", "Deploy to production"] },
      ],
    };
  }

  // Generic JSON response
  return { response: mockChatResponse(systemPrompt, text), mode: "local_fallback" };
}

/**
 * Mock multi-turn conversation.
 */
function mockChatMultiTurn(systemPrompt, messages) {
  const lastMessage = messages[messages.length - 1];
  const text = lastMessage?.content || "";
  return mockChatResponse(systemPrompt, text);
}

/**
 * Mock streaming — yields text in chunks to simulate real streaming.
 */
async function* mockChatStream(systemPrompt, userMessage) {
  const fullResponse = mockChatResponse(systemPrompt, userMessage);
  // Split into word-level chunks for a realistic streaming feel
  const words = fullResponse.split(/\s+/);
  const chunkSize = Math.max(2, Math.ceil(words.length / 6));

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    yield chunk + (i + chunkSize < words.length ? " " : "");
    // Small delay for realism (only in true streaming)
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Mock conversational streaming (multi-turn).
 */
async function* mockConversationalStream(systemPrompt, messages) {
  const lastMessage = messages[messages.length - 1];
  const text = lastMessage?.content || "";
  const fullResponse = mockChatResponse(systemPrompt, text);
  const words = fullResponse.split(/\s+/);
  const chunkSize = Math.max(2, Math.ceil(words.length / 6));

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    yield chunk + (i + chunkSize < words.length ? " " : "");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * Mock image/vision analysis.
 */
function mockChatImage(_systemPrompt, image, prompt) {
  const mimeType = image?.mimeType || "image/unknown";
  return `Image received (${mimeType}). I can see the uploaded content. In local mode, I can confirm the image was captured successfully. Configure a Gemini API key to enable full visual analysis. Your prompt was: "${prompt || "Describe this image"}"`;
}

module.exports = {
  chat: mockChatResponse,
  chatJSON: mockChatJSON,
  chatMultiTurn: mockChatMultiTurn,
  chatImage: mockChatImage,
  chatStream: mockChatStream,
  chatConversational: mockChatMultiTurn,
  chatConversationalStream: mockConversationalStream,
  isAvailable: () => true,
  providerStatus: () => ({
    mock: { configured: true, circuit_open: false, failures: 0, last_error: null },
  }),
};

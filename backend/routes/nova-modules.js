// ============================================
// NOVA — Life Modules
// ============================================
// The 4 modules no other platform has:
//   1. Legal Aid — plain-language legal help
//   2. Farm & Agriculture — crop planning, pest ID, prices
//   3. Mental Wellness — mood tracking, CBT, crisis detection
//   4. Emergency — offline first aid, disaster prep, SOS

const express = require("express");
const ai = require("../services/ai");

const router = express.Router();

// ══════════════════════════════════════════════
// 1. LEGAL AID MODULE
// ══════════════════════════════════════════════

router.post("/legal/ask", async (req, res) => {
  try {
    const { question, country, language } = req.body;
    if (!question) return res.status(400).json({ error: "Missing question" });

    const systemPrompt = `You are a legal information assistant (NOT a lawyer). You explain laws and rights in plain, simple language that anyone can understand.

Rules:
1. Always include a disclaimer that this is informational only, not legal advice.
2. Reference specific laws, acts, or sections when possible.
3. Suggest when the user should consult a real lawyer.
4. Be culturally sensitive and localized.
5. If the country is specified, focus on that country's laws.
6. Keep language simple — 8th grade reading level.${language ? `\n7. Respond in ${language}.` : ""}`;

    if (!ai.isAvailable()) {
      return res.json({
        success: true,
        engine: "local",
        question,
        answer: `I can help explain legal concepts. For "${question}", I recommend consulting a local legal aid clinic or bar association in ${country || "your country"} for specific advice. Many offer free consultations.`,
        disclaimer: "This is general information only, not legal advice. Consult a qualified lawyer for your specific situation.",
        resources: [
          { name: "Legal Aid Society", url: "https://www.legalaid.org" },
          { name: "Free Advice", url: "https://www.freeadvice.com" },
        ],
      });
    }

    const answer = await ai.chat(systemPrompt, `Country: ${country || "General"}\nQuestion: ${question}`);

    res.json({
      success: true,
      engine: "gemini",
      question,
      country: country || "General",
      answer,
      disclaimer: "This is general information only, not legal advice. Consult a qualified lawyer for your specific situation.",
    });
  } catch (err) {
    res.status(500).json({ error: "Legal query failed", details: err.message });
  }
});

router.post("/legal/document", async (req, res) => {
  try {
    const { type, details, country, language } = req.body;
    if (!type) return res.status(400).json({ error: "Missing document type" });

    const systemPrompt = `You are a legal document drafting assistant. Generate a simple, clear template for the requested document type. Include placeholders in [BRACKETS] for personal details.

Rules:
1. Include a disclaimer that this is a template and should be reviewed by a lawyer.
2. Use clear, plain language.
3. Include all standard clauses for the document type.
4. Localize to the specified country if provided.${language ? `\n5. Write in ${language}.` : ""}`;

    if (!ai.isAvailable()) {
      return res.json({
        success: true,
        engine: "local",
        type,
        template: `[DOCUMENT TEMPLATE: ${type}]\n\nThis template requires AI to generate. Please ensure your Gemini API key is configured.`,
        disclaimer: "This is a template only. Have it reviewed by a qualified lawyer before use.",
      });
    }

    const template = await ai.chat(systemPrompt, `Document type: ${type}\nCountry: ${country || "General"}\nDetails: ${details || "Standard template"}`);

    res.json({
      success: true,
      engine: "gemini",
      type,
      template,
      disclaimer: "This is a template only. Have it reviewed by a qualified lawyer before use.",
    });
  } catch (err) {
    res.status(500).json({ error: "Document generation failed", details: err.message });
  }
});

// ══════════════════════════════════════════════
// 2. FARM & AGRICULTURE MODULE
// ══════════════════════════════════════════════

router.post("/farm/crop-advice", async (req, res) => {
  try {
    const { crop, region, season, soil_type, question } = req.body;
    if (!crop && !question) return res.status(400).json({ error: "Missing crop or question" });

    const systemPrompt = `You are an agricultural advisor with deep knowledge of farming practices worldwide. You give practical, actionable advice that a farmer can use immediately.

Rules:
1. Consider the local climate, soil type, and season.
2. Suggest organic methods alongside chemical options.
3. Include planting calendars, water requirements, and expected yields.
4. Use simple language — many farmers may not have formal education.
5. Mention common pests and diseases for the crop.
6. Include market timing advice when relevant.`;

    const userQuery = question || `Advise on growing ${crop} in ${region || "my region"} during ${season || "current season"}. Soil type: ${soil_type || "not specified"}.`;

    if (!ai.isAvailable()) {
      return res.json({
        success: true,
        engine: "local",
        crop: crop || "General",
        advice: `For ${crop || "your crop"} farming advice, consider consulting your local agricultural extension office. They can provide region-specific guidance on planting times, soil preparation, and pest management.`,
        resources: [
          { name: "FAO (UN)", url: "https://www.fao.org" },
          { name: "ICAR (India)", url: "https://icar.org.in" },
        ],
      });
    }

    const advice = await ai.chat(systemPrompt, userQuery);

    res.json({
      success: true,
      engine: "gemini",
      crop: crop || "General",
      region: region || "Not specified",
      season: season || "Not specified",
      advice,
    });
  } catch (err) {
    res.status(500).json({ error: "Farm advice failed", details: err.message });
  }
});

router.post("/farm/pest-identify", async (req, res) => {
  try {
    const { description, crop, symptoms } = req.body;
    if (!description && !symptoms) return res.status(400).json({ error: "Describe the pest or symptoms" });

    const systemPrompt = `You are a pest and disease identification expert. Based on the description of symptoms, identify the most likely pest or disease and provide treatment options.

Include:
1. Most likely identification (top 3 possibilities)
2. Immediate treatment steps
3. Prevention for next season
4. Whether it's safe to eat affected crops
5. Organic treatment options`;

    if (!ai.isAvailable()) {
      return res.json({
        success: true,
        engine: "local",
        identification: "AI identification requires Gemini API. For immediate help, contact your local agricultural extension office or send a photo to a farming community group.",
        emergency_steps: [
          "Isolate affected plants from healthy ones",
          "Take clear photos of the symptoms",
          "Avoid spraying unknown chemicals",
          "Contact your local agricultural extension office",
        ],
      });
    }

    const result = await ai.chat(systemPrompt, `Crop: ${crop || "Unknown"}\nDescription: ${description || ""}\nSymptoms: ${symptoms || ""}`);

    res.json({ success: true, engine: "gemini", crop: crop || "Unknown", analysis: result });
  } catch (err) {
    res.status(500).json({ error: "Pest identification failed", details: err.message });
  }
});

// ══════════════════════════════════════════════
// 3. MENTAL WELLNESS MODULE
// ══════════════════════════════════════════════

const MOOD_SCALE = { 1: "Very low", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" };
const CRISIS_KEYWORDS = [
  "suicide", "kill myself", "end it all", "don't want to live",
  "self harm", "cutting", "overdose", "no reason to live",
  "want to die", "better off dead", "can't go on",
];

router.post("/wellness/mood-checkin", async (req, res) => {
  try {
    const { mood, note, sleep_hours, water_glasses, exercise_minutes } = req.body;

    // Crisis detection
    const noteStr = String(note || "").toLowerCase();
    const isCrisis = CRISIS_KEYWORDS.some((kw) => noteStr.includes(kw));

    if (isCrisis) {
      return res.json({
        success: true,
        crisis_detected: true,
        message: "I hear you, and I want you to know that help is available right now.",
        resources: [
          { name: "National Suicide Prevention Lifeline (US)", phone: "988", url: "https://988lifeline.org" },
          { name: "Crisis Text Line", phone: "Text HOME to 741741", url: "https://www.crisistextline.org" },
          { name: "iCall (India)", phone: "9152987821", url: "https://icallhelpline.org" },
          { name: "Befrienders Worldwide", phone: "Find your country", url: "https://www.befrienders.org" },
          { name: "International Association for Suicide Prevention", url: "https://www.iasp.info/resources/Crisis_Centres/" },
        ],
        immediate_steps: [
          "Please reach out to one of these helplines right now",
          "If you're in immediate danger, call your local emergency number",
          "You don't have to go through this alone",
        ],
      });
    }

    const checkin = {
      timestamp: new Date().toISOString(),
      mood: mood || 3,
      mood_label: MOOD_SCALE[mood] || MOOD_SCALE[3],
      note: note || "",
      metrics: {
        sleep_hours: sleep_hours || null,
        water_glasses: water_glasses || null,
        exercise_minutes: exercise_minutes || null,
      },
    };

    // Generate supportive response
    let response;
    if (ai.isAvailable()) {
      response = await ai.chat(
        `You are a gentle, supportive wellness companion. NOT a therapist. Respond warmly to the user's mood check-in. Keep it short (2-3 sentences). Suggest one small, practical self-care action. Never diagnose or prescribe.`,
        `User checked in: Mood ${mood}/5 (${MOOD_SCALE[mood] || "okay"}). Note: "${note || "none"}". Sleep: ${sleep_hours || "not tracked"} hours. Water: ${water_glasses || "not tracked"} glasses. Exercise: ${exercise_minutes || "not tracked"} minutes.`
      );
    } else {
      const responses = {
        1: "I'm sorry you're having a tough time. That takes courage to acknowledge. Consider reaching out to someone you trust today.",
        2: "It's okay to have low days. Be gentle with yourself. Maybe a short walk or some deep breaths might help.",
        3: "Steady is good. Small consistent steps matter. You're doing alright.",
        4: "Glad to hear things are going well! Keep nurturing what's working for you.",
        5: "That's wonderful! Soak it in. Consider what made today special so you can recreate it.",
      };
      response = responses[mood] || responses[3];
    }

    res.json({
      success: true,
      checkin,
      response,
      disclaimer: "NOVA Wellness is not a replacement for professional mental health care. If you're struggling, please reach out to a qualified therapist or counselor.",
    });
  } catch (err) {
    res.status(500).json({ error: "Mood check-in failed", details: err.message });
  }
});

router.get("/wellness/breathing", (req, res) => {
  const exercises = [
    {
      name: "4-7-8 Breathing",
      description: "Calming technique for anxiety and sleep",
      steps: [
        { action: "breathe_in", duration: 4, instruction: "Breathe in through your nose" },
        { action: "hold", duration: 7, instruction: "Hold your breath" },
        { action: "breathe_out", duration: 8, instruction: "Exhale slowly through your mouth" },
      ],
      cycles: 4,
      total_seconds: 76,
    },
    {
      name: "Box Breathing",
      description: "Focus and calm technique used by Navy SEALs",
      steps: [
        { action: "breathe_in", duration: 4, instruction: "Breathe in" },
        { action: "hold", duration: 4, instruction: "Hold" },
        { action: "breathe_out", duration: 4, instruction: "Breathe out" },
        { action: "hold", duration: 4, instruction: "Hold" },
      ],
      cycles: 5,
      total_seconds: 80,
    },
    {
      name: "5-5 Breathing",
      description: "Simple calming breath for beginners",
      steps: [
        { action: "breathe_in", duration: 5, instruction: "Breathe in slowly" },
        { action: "breathe_out", duration: 5, instruction: "Breathe out slowly" },
      ],
      cycles: 6,
      total_seconds: 60,
    },
  ];

  res.json({ success: true, exercises });
});

router.post("/wellness/journal-prompt", async (req, res) => {
  try {
    const { mood, topic } = req.body;

    if (ai.isAvailable()) {
      const prompt = await ai.chat(
        "You are a CBT-informed journaling assistant. Generate 3 thoughtful journaling prompts. Keep them gentle, open-ended, and non-judgmental. Return as a JSON array of strings.",
        `User mood: ${mood || "neutral"}. Topic interest: ${topic || "general self-reflection"}.`
      );

      try {
        const prompts = JSON.parse(prompt);
        return res.json({ success: true, engine: "gemini", prompts });
      } catch {
        return res.json({ success: true, engine: "gemini", prompts: [prompt] });
      }
    }

    res.json({
      success: true,
      engine: "local",
      prompts: [
        "What is one thing that went well today, even if it was small?",
        "If your feelings right now were a weather pattern, what would it be and why?",
        "What would you tell a friend who was feeling the way you feel right now?",
      ],
    });
  } catch (err) {
    res.status(500).json({ error: "Journal prompt failed", details: err.message });
  }
});

// ══════════════════════════════════════════════
// 4. EMERGENCY MODULE (Offline-capable)
// ══════════════════════════════════════════════

const FIRST_AID = {
  choking: {
    title: "Choking — Adult",
    steps: [
      "Ask 'Are you choking?' — if they can't speak, cough, or breathe, act now",
      "Stand behind them, wrap arms around waist",
      "Make a fist above the navel, below the ribcage",
      "Give 5 quick upward thrusts (Heimlich maneuver)",
      "Repeat until the object comes out or they become unconscious",
      "If unconscious: call emergency services, start CPR",
    ],
    call: "Call your local emergency number immediately",
  },
  burn: {
    title: "Burns",
    steps: [
      "Remove from heat source immediately",
      "Cool the burn under cool (not cold) running water for 10-20 minutes",
      "Do NOT apply ice, butter, or toothpaste",
      "Remove jewelry or tight clothing near the burn before swelling",
      "Cover loosely with a clean, non-stick bandage",
      "For severe burns (larger than your palm, blistered, white/charred): call emergency services",
    ],
    warning: "Do NOT break blisters. Do NOT remove stuck clothing.",
  },
  bleeding: {
    title: "Severe Bleeding",
    steps: [
      "Apply firm, direct pressure with a clean cloth or bandage",
      "Do NOT remove the cloth — add more on top if soaked through",
      "Keep the injured area elevated above the heart if possible",
      "Call emergency services if bleeding doesn't stop after 10 minutes",
      "If limb: apply a tourniquet 2-3 inches above the wound as last resort",
      "Keep the person warm and calm. Monitor for shock.",
    ],
    shock_signs: "Pale skin, rapid pulse, shallow breathing, confusion, cold sweat",
  },
  cpr: {
    title: "CPR — Adult",
    steps: [
      "Check the scene is safe",
      "Tap shoulders and shout 'Are you okay?'",
      "Call emergency services (or ask someone else to)",
      "Place heel of hand on center of chest, other hand on top",
      "Push hard and fast: 2 inches deep, 100-120 compressions per minute",
      "After 30 compressions: tilt head back, lift chin, give 2 rescue breaths",
      "Continue 30:2 cycle until help arrives or they start breathing",
    ],
    rhythm: "Push to the beat of 'Stayin' Alive' by Bee Gees",
  },
  seizure: {
    title: "Seizure / Convulsion",
    steps: [
      "Clear the area of hard or sharp objects",
      "Place something soft under their head",
      "Do NOT restrain them or put anything in their mouth",
      "Time the seizure — call emergency if it lasts more than 5 minutes",
      "When it stops: roll them onto their side (recovery position)",
      "Stay with them until they are fully conscious",
    ],
    warning: "NEVER put fingers, spoons, or objects in the mouth during a seizure",
  },
  heatstroke: {
    title: "Heat Stroke",
    steps: [
      "Move to shade or a cool area immediately",
      "Call emergency services — this is life-threatening",
      "Remove excess clothing",
      "Cool rapidly: wet cloths on neck, armpits, groin",
      "Fan the person while wetting their skin",
      "Give small sips of cool water ONLY if they are conscious and alert",
      "Do NOT give aspirin or acetaminophen",
    ],
    signs: "Body temp above 40°C/104°F, confusion, hot dry skin, rapid pulse",
  },
  snakebite: {
    title: "Snake Bite",
    steps: [
      "Keep calm and still — movement spreads venom faster",
      "Remove jewelry or tight clothing near the bite",
      "Keep the bitten limb below heart level",
      "Call emergency services immediately",
      "Do NOT suck the venom, cut the wound, or apply a tourniquet",
      "Do NOT apply ice",
      "Try to remember the snake's color and shape for identification",
      "Mark the edge of swelling with a pen and note the time",
    ],
    warning: "Do NOT try to catch or kill the snake",
  },
};

const DISASTER_GUIDES = {
  earthquake: {
    title: "Earthquake",
    during: ["Drop to hands and knees", "Take cover under a sturdy desk or table", "Hold on until shaking stops", "Stay away from windows and heavy objects", "If outdoors: move to an open area away from buildings"],
    after: ["Check for injuries", "Be prepared for aftershocks", "Check gas, water, electric lines for damage", "Do NOT use elevators", "Listen to emergency broadcasts"],
  },
  flood: {
    title: "Flood",
    during: ["Move to higher ground immediately", "Do NOT walk, swim, or drive through flood water", "6 inches of moving water can knock you down", "Stay away from power lines", "If trapped: go to the highest point and signal for help"],
    after: ["Do NOT return until authorities say it's safe", "Avoid floodwater — it may be contaminated", "Document damage with photos", "Discard flood-contaminated food"],
  },
  fire: {
    title: "Fire",
    during: ["Get out immediately — do NOT stop to collect belongings", "Stay low — smoke rises", "Feel doors before opening — if hot, use another route", "Close doors behind you to slow the fire", "If clothes catch fire: stop, drop, and roll"],
    after: ["Call emergency services", "Do NOT re-enter the building", "Go to your meeting point", "Account for all family members"],
  },
};

router.get("/emergency/first-aid/:condition", (req, res) => {
  const condition = req.params.condition.toLowerCase().replace(/-/g, "");
  const guide = FIRST_AID[condition];

  if (!guide) {
    return res.json({
      success: true,
      available: Object.keys(FIRST_AID),
      message: "Condition not found. Available guides listed above.",
    });
  }

  res.json({ success: true, guide, offline_capable: true });
});

router.get("/emergency/first-aid", (req, res) => {
  const guides = Object.entries(FIRST_AID).map(([id, guide]) => ({
    id,
    title: guide.title,
  }));
  res.json({ success: true, guides, offline_capable: true });
});

router.get("/emergency/disaster/:type", (req, res) => {
  const type = req.params.type.toLowerCase();
  const guide = DISASTER_GUIDES[type];

  if (!guide) {
    return res.json({
      success: true,
      available: Object.keys(DISASTER_GUIDES),
      message: "Disaster type not found. Available guides listed above.",
    });
  }

  res.json({ success: true, guide, offline_capable: true });
});

router.get("/emergency/contacts", (req, res) => {
  res.json({
    success: true,
    global: [
      { name: "Police (India)", number: "100" },
      { name: "Fire (India)", number: "101" },
      { name: "Ambulance (India)", number: "102 / 108" },
      { name: "Women Helpline (India)", number: "1091 / 181" },
      { name: "Child Helpline (India)", number: "1098" },
      { name: "Emergency (US/Canada)", number: "911" },
      { name: "Emergency (EU)", number: "112" },
      { name: "Emergency (UK)", number: "999" },
      { name: "Emergency (Australia)", number: "000" },
      { name: "Red Cross", url: "https://www.redcross.org" },
    ],
    hint: "Add your personal emergency contacts in Settings → Emergency Contacts",
    offline_capable: true,
  });
});

module.exports = router;

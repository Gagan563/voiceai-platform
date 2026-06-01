// ============================================
// VoiceAI Platform — Module Integration Routes
// ============================================
// Provides real API integrations for frontend modules:
//   Search (Brave + DDG), Finance (Alpha Vantage),
//   Translate (LibreTranslate/DeepL), Media (Spotify)

const express = require("express");
const ai = require("../services/ai");

const router = express.Router();

// ── Search Module ──
// GET /modules/search?q=query
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Missing query parameter ?q=" });

    const results = [];

    // 1. Try Brave Search if key exists
    const braveKey = process.env.BRAVE_API_KEY;
    if (braveKey) {
      try {
        const braveRes = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`,
          { headers: { "X-Subscription-Token": braveKey, Accept: "application/json" } }
        );
        if (braveRes.ok) {
          const data = await braveRes.json();
          for (const r of data.web?.results || []) {
            results.push({ title: r.title, url: r.url, snippet: r.description, engine: "brave" });
          }
          return res.json({ success: true, engine: "brave", query, results, count: results.length });
        }
      } catch (err) {
        console.warn("[Search] Brave failed, falling back:", err.message);
      }
    }

    // 2. Fallback: DuckDuckGo
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const ddg = await ddgRes.json();

    if (ddg.AbstractText) {
      results.push({ title: ddg.Heading || "Summary", url: ddg.AbstractURL, snippet: ddg.AbstractText, engine: "duckduckgo" });
    }
    for (const topic of (ddg.RelatedTopics || []).slice(0, 8)) {
      if (topic.Text) {
        results.push({ title: topic.Text.substring(0, 80), url: topic.FirstURL, snippet: topic.Text, engine: "duckduckgo" });
      }
    }

    res.json({ success: true, engine: braveKey ? "brave_fallback_ddg" : "duckduckgo", query, results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: "Search failed", details: err.message });
  }
});

// ── Finance Module ──
// GET /modules/finance/quote?symbol=AAPL
router.get("/finance/quote", async (req, res) => {
  try {
    const symbol = req.query.symbol;
    if (!symbol) return res.status(400).json({ error: "Missing ?symbol= parameter" });

    const avKey = process.env.ALPHA_VANTAGE_KEY;
    if (!avKey) {
      // Return demo data
      return res.json({
        success: true,
        engine: "demo",
        symbol: symbol.toUpperCase(),
        price: (100 + Math.random() * 200).toFixed(2),
        change: (Math.random() * 10 - 5).toFixed(2),
        changePercent: (Math.random() * 6 - 3).toFixed(2) + "%",
        volume: Math.floor(Math.random() * 50000000),
        hint: "Set ALPHA_VANTAGE_KEY in .env for real data. Free at alphavantage.co/support/#api-key",
      });
    }

    const avRes = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${avKey}`
    );
    const data = await avRes.json();
    const quote = data["Global Quote"];

    if (!quote || !quote["05. price"]) {
      return res.json({ success: false, error: `No data for symbol: ${symbol}` });
    }

    res.json({
      success: true,
      engine: "alpha_vantage",
      symbol: quote["01. symbol"],
      price: quote["05. price"],
      change: quote["09. change"],
      changePercent: quote["10. change percent"],
      volume: quote["06. volume"],
      high: quote["03. high"],
      low: quote["04. low"],
      previousClose: quote["08. previous close"],
    });
  } catch (err) {
    res.status(500).json({ error: "Finance query failed", details: err.message });
  }
});

// GET /modules/finance/portfolio?symbols=AAPL,GOOGL,MSFT
router.get("/finance/portfolio", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "AAPL,GOOGL,MSFT").split(",").map((s) => s.trim().toUpperCase());
    const avKey = process.env.ALPHA_VANTAGE_KEY;

    const quotes = [];
    for (const symbol of symbols.slice(0, 5)) {
      if (avKey) {
        try {
          const avRes = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${avKey}`
          );
          const data = await avRes.json();
          const q = data["Global Quote"];
          if (q && q["05. price"]) {
            quotes.push({
              symbol: q["01. symbol"],
              price: parseFloat(q["05. price"]),
              change: parseFloat(q["09. change"]),
              changePercent: q["10. change percent"],
            });
            continue;
          }
        } catch {}
      }
      // Demo fallback per symbol
      quotes.push({
        symbol,
        price: parseFloat((100 + Math.random() * 200).toFixed(2)),
        change: parseFloat((Math.random() * 10 - 5).toFixed(2)),
        changePercent: (Math.random() * 6 - 3).toFixed(2) + "%",
      });
    }

    res.json({ success: true, engine: avKey ? "alpha_vantage" : "demo", portfolio: quotes });
  } catch (err) {
    res.status(500).json({ error: "Portfolio query failed", details: err.message });
  }
});

// ── Translate Module ──
// POST /modules/translate { text, source, target }
router.post("/translate", async (req, res) => {
  try {
    const { text, source, target } = req.body;
    if (!text || !target) return res.status(400).json({ error: "Missing text or target language" });

    // 1. Try DeepL if key exists
    const deeplKey = process.env.DEEPL_KEY;
    if (deeplKey) {
      try {
        const deeplRes = await fetch("https://api-free.deepl.com/v2/translate", {
          method: "POST",
          headers: { Authorization: `DeepL-Auth-Key ${deeplKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: [text],
            source_lang: source?.toUpperCase() || undefined,
            target_lang: target.toUpperCase(),
          }),
        });
        if (deeplRes.ok) {
          const data = await deeplRes.json();
          const translation = data.translations?.[0];
          return res.json({
            success: true,
            engine: "deepl",
            translated: translation?.text,
            detected_source: translation?.detected_source_language,
            target,
          });
        }
      } catch (err) {
        console.warn("[Translate] DeepL failed:", err.message);
      }
    }

    // 2. Try LibreTranslate (free/self-hosted)
    const libreUrl = process.env.LIBRE_TRANSLATE_URL || "https://libretranslate.com";
    try {
      const libreRes = await fetch(`${libreUrl}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, source: source || "auto", target, format: "text" }),
      });
      if (libreRes.ok) {
        const data = await libreRes.json();
        return res.json({
          success: true,
          engine: "libretranslate",
          translated: data.translatedText,
          source: source || "auto",
          target,
        });
      }
    } catch (err) {
      console.warn("[Translate] LibreTranslate failed:", err.message);
    }

    // 3. Fallback: Use Gemini for translation
    if (ai.isAvailable()) {
      const translated = await ai.chat(
        "You are a professional translator. Translate the following text accurately. Return ONLY the translated text, nothing else.",
        `Translate to ${target}: "${text}"`
      );
      return res.json({ success: true, engine: "gemini", translated: translated.trim(), source: source || "auto", target });
    }

    res.status(503).json({
      error: "No translation engine available",
      hint: "Set DEEPL_KEY in .env, or ensure GEMINI_API_KEY is configured.",
    });
  } catch (err) {
    res.status(500).json({ error: "Translation failed", details: err.message });
  }
});

// ── Media Module (Spotify proxy) ──
// GET /modules/media/now-playing
router.get("/media/now-playing", async (req, res) => {
  const { callConnector } = require("../services/mcp");
  const result = await callConnector({ connectorId: "spotify", action: "get_current_track", params: {} });
  res.json(result);
});

// POST /modules/media/play { query }
router.post("/media/play", async (req, res) => {
  const { callConnector } = require("../services/mcp");
  const result = await callConnector({ connectorId: "spotify", action: "play", params: req.body });
  res.json(result);
});

// POST /modules/media/pause
router.post("/media/pause", async (req, res) => {
  const { callConnector } = require("../services/mcp");
  const result = await callConnector({ connectorId: "spotify", action: "pause", params: {} });
  res.json(result);
});

// POST /modules/media/skip
router.post("/media/skip", async (req, res) => {
  const { callConnector } = require("../services/mcp");
  const result = await callConnector({ connectorId: "spotify", action: "skip", params: {} });
  res.json(result);
});

module.exports = router;

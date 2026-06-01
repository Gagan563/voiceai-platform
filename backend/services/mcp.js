// ============================================
// VoiceAI Platform — MCP Connector Bridge
// ============================================
//
// MCP-style bridge for connector discovery and invocation.
// Each connector has: id, name, configured(), actions[], handler()

const ai = require("./ai");

// ── Connector Handlers ──

async function handleCalendar(action, params) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      success: false,
      status: "not_configured",
      error: "Google Calendar not configured",
      setup: {
        url: "https://console.cloud.google.com/apis/credentials",
        steps: [
          "Create OAuth 2.0 credentials in Google Cloud Console",
          "Enable Google Calendar API",
          "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN to .env",
        ],
      },
    };
  }

  try {
    // Get access token from refresh token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Failed to refresh Google token");

    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    };

    switch (action) {
      case "list_events": {
        const start = params.date_range_start || new Date().toISOString();
        const end =
          params.date_range_end ||
          new Date(Date.now() + 7 * 86400000).toISOString();
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}&singleEvents=true&orderBy=startTime&maxResults=20`,
          { headers }
        );
        const data = await res.json();
        return {
          success: true,
          events: (data.items || []).map((e) => ({
            id: e.id,
            summary: e.summary,
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            attendees: (e.attendees || []).map((a) => a.email),
          })),
        };
      }

      case "create_event": {
        const event = {
          summary: params.title,
          start: { dateTime: params.datetime, timeZone: params.timezone || "UTC" },
          end: {
            dateTime: new Date(
              new Date(params.datetime).getTime() + (params.duration_minutes || 30) * 60000
            ).toISOString(),
            timeZone: params.timezone || "UTC",
          },
          attendees: (params.attendees || []).map((email) => ({ email })),
        };
        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all",
          { method: "POST", headers, body: JSON.stringify(event) }
        );
        const data = await res.json();
        return { success: true, event: { id: data.id, summary: data.summary, link: data.htmlLink } };
      }

      default:
        return { success: false, error: `Unknown calendar action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: `Calendar error: ${err.message}` };
  }
}

async function handleEmail(action, params) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      success: false,
      status: "not_configured",
      error: "Gmail not configured",
      setup: {
        url: "https://console.cloud.google.com/apis/credentials",
        steps: [
          "Create OAuth 2.0 credentials in Google Cloud Console",
          "Enable Gmail API",
          "Add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN to .env",
        ],
      },
    };
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Failed to refresh Gmail token");

    const headers = {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    };

    switch (action) {
      case "read_inbox": {
        const limit = params.limit || 10;
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}`,
          { headers }
        );
        const data = await res.json();
        const messages = [];
        for (const msg of (data.messages || []).slice(0, limit)) {
          const detail = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers }
          );
          const d = await detail.json();
          const getHeader = (name) =>
            d.payload?.headers?.find((h) => h.name === name)?.value || "";
          messages.push({
            id: msg.id,
            from: getHeader("From"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            snippet: d.snippet,
          });
        }
        return { success: true, messages };
      }

      case "send_email": {
        const raw = Buffer.from(
          `To: ${params.to}\r\nSubject: ${params.subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${params.body}`
        ).toString("base64url");
        const res = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          { method: "POST", headers, body: JSON.stringify({ raw }) }
        );
        const data = await res.json();
        return { success: true, messageId: data.id, threadId: data.threadId };
      }

      case "search_emails": {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(params.query)}&maxResults=${params.limit || 10}`,
          { headers }
        );
        const data = await res.json();
        return {
          success: true,
          resultCount: data.resultSizeEstimate || 0,
          messageIds: (data.messages || []).map((m) => m.id),
        };
      }

      default:
        return { success: false, error: `Unknown email action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: `Email error: ${err.message}` };
  }
}

async function handleHomeAssistant(action, params) {
  const baseUrl = process.env.HA_BASE_URL;
  const token = process.env.HA_TOKEN;

  if (!baseUrl || !token) {
    return {
      success: false,
      status: "not_configured",
      error: "Home Assistant not configured",
      setup: {
        url: "https://www.home-assistant.io/docs/authentication/",
        steps: [
          "Get your Home Assistant URL (e.g. http://homeassistant.local:8123)",
          "Create a long-lived access token in HA Profile → Security",
          "Add HA_BASE_URL and HA_TOKEN to .env",
        ],
      },
    };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const api = `${baseUrl.replace(/\/$/, "")}/api`;

  try {
    switch (action) {
      case "get_devices": {
        const res = await fetch(`${api}/states`, { headers });
        const states = await res.json();
        const devices = states
          .filter((s) => !s.entity_id.startsWith("automation.") && !s.entity_id.startsWith("script."))
          .slice(0, 50)
          .map((s) => ({
            entity_id: s.entity_id,
            state: s.state,
            name: s.attributes?.friendly_name || s.entity_id,
            type: s.entity_id.split(".")[0],
          }));
        return { success: true, devices, count: devices.length };
      }

      case "get_state": {
        const res = await fetch(`${api}/states/${params.entity_id}`, { headers });
        if (!res.ok) return { success: false, error: `Entity not found: ${params.entity_id}` };
        const state = await res.json();
        return {
          success: true,
          entity_id: state.entity_id,
          state: state.state,
          name: state.attributes?.friendly_name,
          attributes: state.attributes,
        };
      }

      case "control_device": {
        const domain = params.entity_id.split(".")[0];
        const service = params.action || "toggle";
        const res = await fetch(`${api}/services/${domain}/${service}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            entity_id: params.entity_id,
            ...(params.value != null ? { [domain === "light" ? "brightness_pct" : "temperature"]: params.value } : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          return { success: false, error: `HA service call failed: ${err}` };
        }
        return { success: true, message: `${service} called on ${params.entity_id}` };
      }

      default:
        return { success: false, error: `Unknown HA action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: `Home Assistant error: ${err.message}` };
  }
}

async function handleSpotify(action, params) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      success: false,
      status: "not_configured",
      error: "Spotify not configured",
      setup: {
        url: "https://developer.spotify.com/dashboard",
        steps: [
          "Create an app at developer.spotify.com/dashboard",
          "Get Client ID and Client Secret",
          "Use the Authorization Code flow to get a refresh token",
          "Add SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN to .env",
        ],
      },
    };
  }

  try {
    // Get access token
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("Failed to refresh Spotify token");

    const headers = { Authorization: `Bearer ${tokenData.access_token}` };
    const api = "https://api.spotify.com/v1";

    switch (action) {
      case "get_current_track": {
        const res = await fetch(`${api}/me/player/currently-playing`, { headers });
        if (res.status === 204) return { success: true, playing: false, message: "Nothing playing" };
        const data = await res.json();
        return {
          success: true,
          playing: data.is_playing,
          track: data.item?.name,
          artist: data.item?.artists?.map((a) => a.name).join(", "),
          album: data.item?.album?.name,
          progress_ms: data.progress_ms,
          duration_ms: data.item?.duration_ms,
        };
      }

      case "play": {
        if (params.query) {
          // Search and play
          const searchRes = await fetch(
            `${api}/search?q=${encodeURIComponent(params.query)}&type=track&limit=1`,
            { headers }
          );
          const searchData = await searchRes.json();
          const track = searchData.tracks?.items?.[0];
          if (!track) return { success: false, error: `No results for: ${params.query}` };
          await fetch(`${api}/me/player/play`, {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ uris: [track.uri] }),
          });
          return { success: true, message: `Playing: ${track.name} by ${track.artists[0]?.name}` };
        }
        await fetch(`${api}/me/player/play`, { method: "PUT", headers });
        return { success: true, message: "Playback resumed" };
      }

      case "pause": {
        await fetch(`${api}/me/player/pause`, { method: "PUT", headers });
        return { success: true, message: "Playback paused" };
      }

      case "skip": {
        await fetch(`${api}/me/player/next`, { method: "POST", headers });
        return { success: true, message: "Skipped to next track" };
      }

      case "set_volume": {
        const vol = Math.max(0, Math.min(100, params.level || 50));
        await fetch(`${api}/me/player/volume?volume_percent=${vol}`, { method: "PUT", headers });
        return { success: true, message: `Volume set to ${vol}%` };
      }

      default:
        return { success: false, error: `Unknown Spotify action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: `Spotify error: ${err.message}` };
  }
}

// ── Connector Registry ──

const connectors = {
  calendar: {
    name: "Google Calendar",
    configured: () =>
      Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN),
    actions: ["list_events", "create_event"],
    handler: handleCalendar,
  },
  email: {
    name: "Gmail",
    configured: () =>
      Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN),
    actions: ["send_email", "read_inbox", "search_emails"],
    handler: handleEmail,
  },
  home_assistant: {
    name: "Home Assistant",
    configured: () => Boolean(process.env.HA_BASE_URL && process.env.HA_TOKEN),
    actions: ["get_devices", "control_device", "get_state"],
    handler: handleHomeAssistant,
  },
  spotify: {
    name: "Spotify",
    configured: () =>
      Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REFRESH_TOKEN),
    actions: ["play", "pause", "skip", "get_current_track", "set_volume"],
    handler: handleSpotify,
  },
  web_search: {
    name: "Web Search",
    configured: () => true, // DuckDuckGo always available
    actions: ["search"],
    handler: async (action, params) => {
      try {
        // Try Brave first if key exists
        const braveKey = process.env.BRAVE_API_KEY;
        if (braveKey) {
          const res = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(params.query)}&count=${params.limit || 5}`,
            { headers: { "X-Subscription-Token": braveKey, Accept: "application/json" } }
          );
          if (res.ok) {
            const data = await res.json();
            return {
              success: true,
              engine: "brave",
              results: (data.web?.results || []).map((r) => ({
                title: r.title,
                url: r.url,
                snippet: r.description,
              })),
            };
          }
        }

        // Fallback: DuckDuckGo
        const res = await fetch(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1&skip_disambig=1`
        );
        const data = await res.json();
        const results = [];
        if (data.AbstractText) {
          results.push({ title: data.Heading || "Summary", snippet: data.AbstractText, url: data.AbstractURL });
        }
        for (const topic of (data.RelatedTopics || []).slice(0, 5)) {
          if (topic.Text) results.push({ title: topic.Text.substring(0, 60), snippet: topic.Text, url: topic.FirstURL });
        }
        return { success: true, engine: "duckduckgo", results };
      } catch (err) {
        return { success: false, error: `Search error: ${err.message}` };
      }
    },
  },
};

// ── Public API ──

function listConnectors() {
  return Object.entries(connectors).map(([id, c]) => ({
    id,
    name: c.name,
    configured: c.configured(),
    actions: c.actions,
  }));
}

function connectorStatus(id) {
  const c = connectors[id];
  if (!c) return null;
  return {
    id,
    name: c.name,
    configured: c.configured(),
    actions: c.actions,
  };
}

async function callConnector({ connectorId, action, params = {} }) {
  const connector = connectors[connectorId];
  if (!connector) {
    return { success: false, status: "unknown_connector", error: `Unknown connector: ${connectorId}` };
  }

  if (!connector.actions.includes(action)) {
    return { success: false, status: "unknown_action", error: `${connector.name} does not support: ${action}` };
  }

  // Call the real handler
  try {
    const result = await connector.handler(action, params);
    return { ...result, connector: connectorId, action };
  } catch (err) {
    return { success: false, error: `${connector.name} handler error: ${err.message}`, connector: connectorId, action };
  }
}

module.exports = { listConnectors, connectorStatus, callConnector };

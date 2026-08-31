// ============================================
// VoxMind Mobile — API Client
// ============================================

import axios from "axios";

// Android emulator: 10.0.2.2 = host localhost
// iOS simulator: localhost works
// Real device: use your machine's LAN IP
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:3001";

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export async function login(email, password) {
  const { data } = await api.post("/api/auth/login", { email, password });
  if (data?.token) setAuthToken(data.token);
  return data;
}

export async function register(email, password, name) {
  const { data } = await api.post("/api/auth/register", { email, password, name });
  if (data?.token) setAuthToken(data.token);
  return data;
}

export async function logout() {
  setAuthToken(null);
  const { data } = await api.post("/api/auth/logout");
  return data;
}

export async function healthCheck() {
  const { data } = await api.get("/health");
  return data;
}

export async function transcribeAudio(filePath) {
  const form = new FormData();
  form.append("audio", {
    uri: filePath,
    type: "audio/wav",
    name: "recording.wav",
  });
  const { data } = await api.post("/transcribe", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,
  });
  return data;
}

export async function extractIntent(text) {
  const { data } = await api.post("/intent", { text });
  return data;
}

export async function generatePlan(intent) {
  const { data } = await api.post("/plan", { intent });
  return data;
}

export async function executePlan(plan) {
  const { data } = await api.post("/execute", { plan });
  return data;
}

export async function getConnectors() {
  const { data } = await api.get("/mcp/connectors");
  return data;
}

export async function callConnector(connectorId, action, params = {}) {
  const { data } = await api.post("/mcp/call", { connectorId, action, params });
  return data;
}

export async function searchWeb(query) {
  const { data } = await api.get(`/modules/search?q=${encodeURIComponent(query)}`);
  return data;
}

export async function translate(text, target) {
  const { data } = await api.post("/modules/translate", { text, target });
  return data;
}

export async function getQuote(symbol) {
  const { data } = await api.get(`/modules/finance/quote?symbol=${encodeURIComponent(symbol)}`);
  return data;
}

export default api;

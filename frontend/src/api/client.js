import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";
    const hint = error.response?.data?.hint || null;

    console.error("[API Error]", {
      status: error.response?.status,
      message,
      hint,
      url: error.config?.url,
    });

    return Promise.reject({
      message,
      hint,
      status: error.response?.status,
    });
  }
);

export async function extractIntent(text) {
  return client.post("/intent", { text });
}

export async function generatePlan(intent) {
  return client.post("/plan", { intent });
}

export async function executePlan(plan) {
  return client.post("/execute", { plan });
}

export async function transcribeAudio(audioFile) {
  const formData = new FormData();
  formData.append("audio", audioFile);

  return client.post("/transcribe", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function healthCheck() {
  return client.get("/health");
}

export default client;

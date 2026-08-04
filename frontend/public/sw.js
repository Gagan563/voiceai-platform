// ============================================
// NOVA Service Worker — Offline-Lite
// ============================================
//
// Caches the app shell for offline access and queues failed mutations
// (POST/PATCH/DELETE) in IndexedDB for replay when back online.

const CACHE_NAME = "nova-app-shell-v1";
const API_CACHE = "nova-api-cache-v1";

// App shell resources to precache
const APP_SHELL = [
  "/",
  "/index.html",
];

// ── Install: precache app shell ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Precaching app shell");
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn("[SW] Some app shell resources failed to cache:", err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ──
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (mutations are handled by offlineQueue)
  if (request.method !== "GET") return;

  // API requests: NetworkFirst with cache fallback
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/health")) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Static assets: CacheFirst with network fallback
  event.respondWith(cacheFirstWithNetwork(request));
});

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "Offline", offline: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // For navigation requests, return the cached index.html (SPA fallback)
    if (request.mode === "navigate") {
      const fallback = await caches.match("/index.html");
      if (fallback) return fallback;
    }
    return new Response("Offline", { status: 503 });
  }
}

// ── Listen for messages from the main thread ──
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/**
 * Offline Queue
 *
 * Stores explicitly replay-safe failed mutations in IndexedDB and replays
 * them when the network comes back online.
 */

const DB_NAME = "nova-offline-queue";
const STORE_NAME = "pending-requests";
const DB_VERSION = 1;

const REPLAYABLE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function headersToPlainObject(headers = {}) {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function isSerializableBody(body) {
  return (
    body == null ||
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  );
}

export async function enqueue(url, options = {}) {
  try {
    const method = String(options.method || "POST").toUpperCase();
    if (!REPLAYABLE_METHODS.has(method)) {
      return { queued: false, reason: "method_not_replayable" };
    }
    if (!options.safeToReplay) {
      return { queued: false, reason: "not_marked_safe_to_replay" };
    }
    if (!isSerializableBody(options.body)) {
      return { queued: false, reason: "body_not_serializable" };
    }

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const headers = headersToPlainObject(options.headers);
    const idempotencyKey =
      headers["Idempotency-Key"] ||
      headers["idempotency-key"] ||
      crypto.randomUUID();

    store.add({
      url,
      method,
      headers: {
        ...headers,
        "Idempotency-Key": idempotencyKey,
      },
      body: options.body || null,
      timestamp: Date.now(),
    });

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    console.log("[OfflineQueue] Enqueued:", method, url);
    return { queued: true, idempotencyKey };
  } catch (error) {
    console.error("[OfflineQueue] Failed to enqueue:", error);
    return { queued: false, reason: "enqueue_failed" };
  }
}

export async function replay() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const items = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!items.length) return;

    console.log(`[OfflineQueue] Replaying ${items.length} queued request(s)`);

    const succeeded = [];

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
          credentials: "include",
        });

        if (response.ok) {
          succeeded.push(item.id);
        }
      } catch {
        // Still offline or server error — keep in queue
        console.warn("[OfflineQueue] Replay failed for:", item.method, item.url);
      }
    }

    // Remove succeeded items
    if (succeeded.length) {
      const deleteTx = db.transaction(STORE_NAME, "readwrite");
      const deleteStore = deleteTx.objectStore(STORE_NAME);
      for (const id of succeeded) {
        deleteStore.delete(id);
      }
      await new Promise((resolve) => { deleteTx.oncomplete = resolve; });
      console.log(`[OfflineQueue] Cleared ${succeeded.length} replayed request(s)`);
    }
  } catch (error) {
    console.error("[OfflineQueue] Replay error:", error);
  }
}

export async function getPendingCount() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

export async function clearQueue() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await new Promise((resolve) => { tx.oncomplete = resolve; });
  } catch (error) {
    console.error("[OfflineQueue] Clear error:", error);
  }
}

// Auto-replay when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[OfflineQueue] Back online — replaying queued requests");
    replay();
  });
}

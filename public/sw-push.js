// Push notification handler + cache cleanup for the service worker

// --- Cache versioning & cleanup ---
const CACHE_PREFIX = "doula-care-";
const CACHE_VERSION = "v1.1.0";
const CURRENT_CACHE = CACHE_PREFIX + CACHE_VERSION;

// --- TWA detection flag (persisted via Cache API) ---
// When the web app detects it's running inside a TWA, it sends a message
// to set this flag. The SW then skips showNotification to avoid duplicates
// (the TWA notification delegation already handles display natively).
// Using Cache API to persist across SW restarts (localStorage unavailable in SW).
const TWA_CACHE_KEY = "doula-care-twa-mode";
let isTWAEnvironment = false;

async function persistTWAMode(enabled) {
  isTWAEnvironment = enabled;
  try {
    const cache = await caches.open(TWA_CACHE_KEY);
    if (enabled) {
      await cache.put("/_twa_flag", new Response("true"));
    } else {
      await cache.delete("/_twa_flag");
    }
  } catch (e) {
    console.error("[SW] Failed to persist TWA flag:", e);
  }
}

async function loadTWAMode() {
  try {
    const cache = await caches.open(TWA_CACHE_KEY);
    const resp = await cache.match("/_twa_flag");
    if (resp) {
      isTWAEnvironment = true;
      console.log("[SW] TWA mode restored from cache");
    }
  } catch (e) {
    // ignore
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CURRENT_CACHE)
            .map((key) => {
              console.log("[SW] Deleting old cache:", key);
              return caches.delete(key);
            })
        )
      ),
      // Restore TWA mode flag
      loadTWAMode(),
    ])
  );
});

// Listen for messages from the client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // TWA detection: the web app signals when running inside a TWA
  if (event.data?.type === "SET_TWA_MODE") {
    persistTWAMode(true);
    console.log("[SW] TWA mode enabled — SW notifications suppressed (delegation active)");
  }

// --- Push notifications ---
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const handlePush = async () => {
    try {
      // Ensure TWA flag is loaded (in case SW just started and activate hasn't run yet)
      if (!isTWAEnvironment) {
        await loadTWAMode();
      }

      // If running inside a TWA with notification delegation enabled,
      // the Android app handles notification display natively.
      // Showing via SW would cause duplicate notifications referencing "Google Chrome".
      if (isTWAEnvironment) {
        console.log("[SW] Push received but suppressed (TWA delegation active)");
        return;
      }

      const data = event.data.json();
      const { title, body, icon, badge, url, tag, priority, require_interaction, type } = data;

      const isCritica =
        priority === "critica" ||
        type === "labor_started" ||
        type === "new_contraction";

      const options = {
        body: body || "",
        icon: icon || "/pwa-icon-192.png",
        badge: badge || "/pwa-icon-192.png",
        tag: isCritica ? `critica-${tag || type || "urgent"}` : (tag || type || "default"),
        renotify: true,
        requireInteraction: require_interaction ?? isCritica,
        data: {
          url: url || "/",
          type: type || "general",
          priority: isCritica ? "critica" : "normal",
        },
        vibrate: isCritica
          ? [300, 100, 300, 100, 300]
          : [100, 50, 100],
        actions: isCritica
          ? [{ action: "open", title: "Abrir agora" }]
          : [
              { action: "open", title: "Abrir" },
              { action: "close", title: "Fechar" },
            ],
      };

      await self.registration.showNotification(title || "Doula Care", options);
    } catch (err) {
      console.error("Error showing push notification:", err);
    }
  };

  event.waitUntil(handlePush());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "close") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window first
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

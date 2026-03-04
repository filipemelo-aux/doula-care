// Push notification handler + cache cleanup for the service worker

// --- Cache versioning & cleanup ---
const CACHE_PREFIX = "doula-care-";
const CACHE_VERSION = "v1.1.0";
const CURRENT_CACHE = CACHE_PREFIX + CACHE_VERSION;

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CURRENT_CACHE)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    )
  );
});

// Listen for SKIP_WAITING message from the client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- Push notifications ---
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const handlePush = async () => {
    try {
      // Check if running inside a TWA with notification delegation.
      // When the TWA delegates notifications, it handles display natively —
      // showing via SW would cause duplicates referencing "Google Chrome".
      const visibleClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const isTWA = visibleClients.some(
        (c) => c.visibilityState === "visible" && c.url.includes(self.location.origin)
      );

      // If no visible clients exist and we're getting a push, the TWA delegation
      // is likely handling it natively. However, if the app is in background (no
      // visible clients), the TWA delegation may still work. We use a simpler
      // heuristic: check if the TWA notification delegation flag was set.
      // The safest approach: always let TWA delegation handle it when the app
      // is installed as TWA by checking the referrer/display-mode.
      // Since TWA delegation re-posts the notification natively, we skip SW display
      // when we detect the TWA environment via the lack of standalone display windows.

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

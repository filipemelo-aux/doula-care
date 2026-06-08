// Push notification handler + cache cleanup for the service worker

// --- Cache versioning & cleanup ---
const CACHE_PREFIX = "doula-care-";
const CACHE_VERSION = "v1.2.2.0806.3";
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

// Listen for messages from the client
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- Push notifications ---
// IMPORTANT: In TWA mode with notification delegation, the SW MUST call
// showNotification(). The TWA shell intercepts this call and displays it
// as a native notification (without Chrome branding). Suppressing the call
// would result in NO notification at all.
// Duplicate prevention is handled server-side by deduplicating subscriptions.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const handlePush = async () => {
    try {
      const data = event.data.json();
      const { title, body, icon, badge, image, url, tag, priority, require_interaction, type } = data;

      const isCritica =
        priority === "critica" ||
        type === "labor_started" ||
        type === "new_contraction";

      const origin = self.location.origin;
      const resolveUrl = (path) => path && path.startsWith("/") ? origin + path : (path || "");

      const resolvedIcon = resolveUrl(icon || "/logo.png");
      const resolvedBadge = resolveUrl(badge || "/badge-mono-v2.png");
      const resolvedImage = image ? resolveUrl(image) : undefined;

      const options = {
        body: body || "",
        icon: resolvedIcon,
        badge: resolvedBadge,
        ...(resolvedImage ? { image: resolvedImage } : {}),
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

  const rawUrl = event.notification.data?.url || "/";
  // Add marker so the app knows this was opened from a notification
  const separator = rawUrl.includes("?") ? "&" : "?";
  const url = rawUrl + separator + "from_notification=1";

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

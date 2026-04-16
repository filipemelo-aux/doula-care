import { APP_VERSION } from "./appVersion";

let refreshPromise: Promise<void> | null = null;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const getVersionedUrl = () => {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("_appv", APP_VERSION);
  nextUrl.searchParams.set("_t", Date.now().toString());
  return nextUrl.toString();
};

export const stripAppRefreshParams = () => {
  const currentUrl = new URL(window.location.href);
  const hasRefreshParams = currentUrl.searchParams.has("_appv") || currentUrl.searchParams.has("_t");

  if (!hasRefreshParams) return;

  currentUrl.searchParams.delete("_appv");
  currentUrl.searchParams.delete("_t");

  const cleanUrl = currentUrl.pathname + (currentUrl.search ? currentUrl.search : "") + currentUrl.hash;
  window.history.replaceState(window.history.state, "", cleanUrl);
};

export const hardRefreshApp = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();

        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.update();
            } catch {
              // no-op
            }

            try {
              registration.waiting?.postMessage({ type: "SKIP_WAITING" });
            } catch {
              // no-op
            }
          })
        );

        await wait(150);

        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.unregister();
            } catch {
              // no-op
            }
          })
        );
      }

      if ("caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
    } catch (error) {
      console.error("[AppUpdate] hard refresh failed:", error);
    } finally {
      window.location.replace(getVersionedUrl());
    }
  })();

  return refreshPromise;
};
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getCachedBranding, applyThemeToDOM } from "@/hooks/useOrgBranding";

// Apply cached org branding immediately before React renders to avoid theme flash
const cached = getCachedBranding();
if (cached) {
  applyThemeToDOM(cached.primary, cached.secondary);
}

// Detect Android app context and keep Service Worker TWA mode in sync.
// This suppresses Chrome-branded notifications when native delegation is active.
if ("serviceWorker" in navigator) {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isStandaloneLike =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches;
  const hasAndroidReferrer = document.referrer.startsWith("android-app://");
  const isTWALikely = isAndroid && (hasAndroidReferrer || isStandaloneLike);

  const syncTWAMode = (enabled: boolean) => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      const payload = { type: "SET_TWA_MODE", enabled };
      reg.active?.postMessage(payload);
      reg.waiting?.postMessage(payload);
      reg.installing?.postMessage(payload);
    });
  };

  // Send once immediately and reinforce after worker lifecycle changes.
  syncTWAMode(isTWALikely);
  navigator.serviceWorker.ready.then(() => syncTWAMode(isTWALikely));
  navigator.serviceWorker.addEventListener("controllerchange", () => syncTWAMode(isTWALikely));
}

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getCachedBranding, applyThemeToDOM } from "@/hooks/useOrgBranding";

// Apply cached org branding immediately before React renders to avoid theme flash
const cached = getCachedBranding();
if (cached) {
  applyThemeToDOM(cached.primary, cached.secondary);
}

// Detect TWA environment and notify Service Worker to suppress duplicate notifications.
// When running inside a TWA with notification delegation, the Android app shows
// notifications natively — the SW should NOT also show them (avoids Chrome-branded duplicates).
if ("serviceWorker" in navigator) {
  const isTWA =
    document.referrer.includes("android-app://") ||
    (window.matchMedia("(display-mode: standalone)").matches &&
      /Android/i.test(navigator.userAgent));

  if (isTWA) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: "SET_TWA_MODE" });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);

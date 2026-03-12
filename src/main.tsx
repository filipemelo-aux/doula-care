import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getCachedBranding, applyThemeToDOM } from "@/hooks/useOrgBranding";
import { isCapacitorNative, setupNativePushListeners } from "@/lib/capacitorPush";
import { configureNativeBars } from "@/lib/capacitorNativeUI";

// Apply cached org branding immediately before React renders to avoid theme flash
const cached = getCachedBranding();
if (cached) {
  applyThemeToDOM(cached.primary, cached.secondary);
}

// Suppress Chrome's PWA install mini-infobar on mobile devices
const isMobileUA = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
if (isMobileUA) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
  });
}

let nativeBootstrapped = false;

const reapplyNativeBars = () => {
  if (!isCapacitorNative()) return;
  void configureNativeBars();
};

const bootstrapNativeFeatures = () => {
  if (nativeBootstrapped || !isCapacitorNative()) return;
  nativeBootstrapped = true;

  setupNativePushListeners();
  reapplyNativeBars();

  window.addEventListener("focus", reapplyNativeBars);
  document.addEventListener("resume", reapplyNativeBars);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) reapplyNativeBars();
  });
};

// Try immediately and retry for delayed native bridge initialization.
bootstrapNativeFeatures();
[300, 1500, 4000].forEach((delay) => {
  setTimeout(() => {
    bootstrapNativeFeatures();
    reapplyNativeBars();
  }, delay);
});

createRoot(document.getElementById("root")!).render(<App />);


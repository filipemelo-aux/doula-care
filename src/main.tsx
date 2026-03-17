import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isCapacitorNative, setupNativePushListeners } from "@/lib/capacitorPush";
import { configureNativeBars } from "@/lib/capacitorNativeUI";
import { getCachedBranding } from "@/hooks/useOrgBranding";

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
  const cachedColor = getCachedBranding()?.primary;
  void configureNativeBars(cachedColor || undefined);
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

// Delay React mount to show splash a bit longer
setTimeout(() => {
  createRoot(document.getElementById("root")!).render(<App />);

  // Fade out splash after React mounts
  const splash = document.getElementById("app-splash");
  if (splash) {
    splash.style.transition = "opacity 0.4s ease";
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 400);
  }
}, 1200);


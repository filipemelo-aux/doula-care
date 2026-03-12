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

// Initialize native plugins early
if (isCapacitorNative()) {
  setupNativePushListeners();
  void configureNativeBars();

  // Re-apply on focus/visibility changes (app resume)
  const reapplyNativeBars = () => void configureNativeBars();
  window.addEventListener("focus", reapplyNativeBars);
  document.addEventListener("resume", reapplyNativeBars);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) reapplyNativeBars();
  });

  // Retry after a delay for slow bridge init
  setTimeout(reapplyNativeBars, 1500);
  setTimeout(reapplyNativeBars, 4000);
}

createRoot(document.getElementById("root")!).render(<App />);

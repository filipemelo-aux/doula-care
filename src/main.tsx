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
  configureNativeBars();
}

createRoot(document.getElementById("root")!).render(<App />);

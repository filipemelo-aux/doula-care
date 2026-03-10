import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getCachedBranding, applyThemeToDOM } from "@/hooks/useOrgBranding";
import { isCapacitorNative, setupNativePushListeners } from "@/lib/capacitorPush";

// Apply cached org branding immediately before React renders to avoid theme flash
const cached = getCachedBranding();
if (cached) {
  applyThemeToDOM(cached.primary, cached.secondary);
}

// Initialize native push listeners early for deep link handling
if (isCapacitorNative()) {
  setupNativePushListeners();
}

createRoot(document.getElementById("root")!).render(<App />);

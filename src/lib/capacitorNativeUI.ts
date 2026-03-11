/**
 * Capacitor native UI utilities for StatusBar and NavigationBar.
 * Uses dynamic imports to avoid build errors in web-only environments.
 */
import { isCapacitorNative } from "@/lib/capacitorPush";

/** Lazy-load StatusBar plugin */
const getStatusBarPlugin = async () => {
  const modName = "@capacitor/" + "status-bar";
  const mod = await (Function("m", "return import(m)")(modName) as Promise<any>);
  return mod.StatusBar;
};

/**
 * Configure native status bar and navigation bar appearance.
 * Uses the app's theme color (#c34a1c) for a branded look.
 */
export async function configureNativeBars() {
  if (!isCapacitorNative()) return;

  try {
    const StatusBar = await getStatusBarPlugin();

    // Set status bar to overlay mode so content renders behind it
    await StatusBar.setOverlaysWebView({ overlay: true });

    // Use light content (white icons) on the dark terracotta background
    await StatusBar.setStyle({ style: "LIGHT" });

    // Set the background color (visible when not overlaying)
    await StatusBar.setBackgroundColor({ color: "#c34a1c" });

    console.log("[NativeUI] Status bar configured");
  } catch (err) {
    console.error("[NativeUI] StatusBar config error:", err);
  }
}

/**
 * Capacitor native UI utilities for StatusBar and NavigationBar.
 * Accesses plugins via the Capacitor bridge (window.Capacitor.Plugins)
 * since the app loads a remote URL and npm dynamic imports won't work.
 */
import { isCapacitorNative } from "@/lib/capacitorPush";

/** Get StatusBar plugin from the Capacitor bridge */
const getStatusBarPlugin = () => {
  try {
    const cap = (window as any).Capacitor;
    return cap?.Plugins?.StatusBar ?? null;
  } catch {
    return null;
  }
};

/** Get NavigationBar plugin from the Capacitor bridge */
const getNavigationBarPlugin = () => {
  try {
    const cap = (window as any).Capacitor;
    return cap?.Plugins?.NavigationBar ?? null;
  } catch {
    return null;
  }
};

/** Wait for the Capacitor bridge to be available (max ~3s) */
async function waitForBridge(maxAttempts = 15): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if ((window as any).Capacitor?.Plugins) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

/**
 * Configure native status bar and navigation bar appearance.
 * Uses the app's theme color (#c34a1c) for a branded look.
 * Retries if the bridge isn't ready immediately (remote URL loading).
 */
export async function configureNativeBars() {
  if (!isCapacitorNative()) return;

  const bridgeReady = await waitForBridge();
  if (!bridgeReady) {
    console.warn("[NativeUI] Capacitor bridge not available after waiting");
    return;
  }

  // Configure Status Bar
  try {
    const StatusBar = getStatusBarPlugin();
    if (StatusBar) {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: "LIGHT" });
      await StatusBar.setBackgroundColor({ color: "#c34a1c" });
      console.log("[NativeUI] Status bar configured");
    } else {
      console.warn("[NativeUI] StatusBar plugin not found on bridge");
    }
  } catch (err) {
    console.error("[NativeUI] StatusBar config error:", err);
  }

  // Configure Navigation Bar (bottom bar)
  try {
    const NavigationBar = getNavigationBarPlugin();
    if (NavigationBar) {
      await NavigationBar.setNavigationBarColor({
        color: "#c34a1c",
        darkButtons: false,
      });
      console.log("[NativeUI] Navigation bar configured");
    } else {
      console.warn("[NativeUI] NavigationBar plugin not found on bridge");
    }
  } catch (err) {
    console.error("[NativeUI] NavigationBar config error:", err);
  }
}

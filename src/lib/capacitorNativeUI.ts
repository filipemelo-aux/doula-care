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

/** Lazy-load NavigationBar plugin */
const getNavigationBarPlugin = async () => {
  const modName = "@capgo/capacitor-" + "navigation-bar";
  const mod = await (Function("m", "return import(m)")(modName) as Promise<any>);
  return mod.NavigationBar;
};

/**
 * Configure native status bar and navigation bar appearance.
 * Uses the app's theme color (#c34a1c) for a branded look.
 */
export async function configureNativeBars() {
  if (!isCapacitorNative()) return;

  // Configure Status Bar
  try {
    const StatusBar = await getStatusBarPlugin();

    // Do NOT overlay — content should NOT render behind the status bar
    await StatusBar.setOverlaysWebView({ overlay: false });

    // Use light content (white icons) on the dark terracotta background
    await StatusBar.setStyle({ style: "LIGHT" });

    // Set the background color
    await StatusBar.setBackgroundColor({ color: "#c34a1c" });

    console.log("[NativeUI] Status bar configured");
  } catch (err) {
    console.error("[NativeUI] StatusBar config error:", err);
  }

  // Configure Navigation Bar (bottom bar)
  try {
    const NavigationBar = await getNavigationBarPlugin();

    await NavigationBar.setNavigationBarColor({
      color: "#c34a1c",
      darkButtons: false,
    });

    console.log("[NativeUI] Navigation bar configured");
  } catch (err) {
    console.error("[NativeUI] NavigationBar config error:", err);
  }
}

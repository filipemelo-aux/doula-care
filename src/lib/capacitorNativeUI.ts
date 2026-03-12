/**
 * Capacitor native UI utilities for StatusBar and NavigationBar.
 * Accesses plugins via the Capacitor bridge (window.Capacitor.Plugins)
 * since the app loads a remote URL and npm dynamic imports won't work.
 */
import { isCapacitorNative } from "@/lib/capacitorPush";

const PRIMARY_BAR_COLOR = "#c34a1c";
const ANDROID_TOP_INSET_FALLBACK = 28;
const ANDROID_BOTTOM_INSET_FALLBACK = 48;

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
    return cap?.Plugins?.NavigationBar ?? cap?.Plugins?.CapacitorNavigationBar ?? null;
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

function applyAndroidSafeAreaFallbacks() {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const currentTop = Number.parseFloat(styles.getPropertyValue("--safe-area-inset-top")) || 0;
  const currentBottom = Number.parseFloat(styles.getPropertyValue("--safe-area-inset-bottom")) || 0;

  if (currentTop < ANDROID_TOP_INSET_FALLBACK) {
    root.style.setProperty("--safe-area-inset-top", `${ANDROID_TOP_INSET_FALLBACK}px`);
  }

  if (currentBottom < ANDROID_BOTTOM_INSET_FALLBACK) {
    root.style.setProperty("--safe-area-inset-bottom", `${ANDROID_BOTTOM_INSET_FALLBACK}px`);
  }
}

function applyNativeBarColorFallback() {
  document.documentElement.classList.add("native-system-bars");
}

async function configureStatusBar() {
  const StatusBar = getStatusBarPlugin();
  if (!StatusBar) {
    console.warn("[NativeUI] StatusBar plugin not found on bridge");
    return;
  }

  await StatusBar.setOverlaysWebView({ overlay: false });
  await StatusBar.setStyle({ style: "DARK" });
  await StatusBar.setBackgroundColor({ color: PRIMARY_BAR_COLOR });
}

async function configureNavigationBar() {
  const NavigationBar = getNavigationBarPlugin();
  if (!NavigationBar) {
    console.warn("[NativeUI] NavigationBar plugin not found on bridge");
    return;
  }

  if (typeof NavigationBar.setNavigationBarColor === "function") {
    await NavigationBar.setNavigationBarColor({
      color: PRIMARY_BAR_COLOR,
      darkButtons: false,
    });
    return;
  }

  if (typeof NavigationBar.setColor === "function") {
    await NavigationBar.setColor({
      color: PRIMARY_BAR_COLOR,
      darkButtons: false,
    });
    return;
  }

  console.warn("[NativeUI] NavigationBar plugin found but no color method available");
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

  applyAndroidSafeAreaFallbacks();
  applyNativeBarColorFallback();

  try {
    await configureStatusBar();
    console.log("[NativeUI] Status bar configured");
  } catch (err) {
    console.error("[NativeUI] StatusBar config error:", err);
  }

  try {
    await configureNavigationBar();
    console.log("[NativeUI] Navigation bar configured");
  } catch (err) {
    console.error("[NativeUI] NavigationBar config error:", err);
  }

  // Second pass helps devices/webviews that apply bar styles only after first paint.
  setTimeout(() => {
    void configureStatusBar();
    void configureNavigationBar();
    applyAndroidSafeAreaFallbacks();
    applyNativeBarColorFallback();
  }, 500);
}


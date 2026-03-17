/**
 * Capacitor native UI utilities for StatusBar and NavigationBar.
 * Accesses plugins via the Capacitor bridge (window.Capacitor.Plugins)
 * since the app loads a remote URL and npm dynamic imports won't work.
 */
import { isCapacitorNative } from "@/lib/capacitorPush";

const DEFAULT_BAR_COLOR = "#ffffff";
const ANDROID_TOP_INSET_FALLBACK = 28;
const ANDROID_BOTTOM_INSET_FALLBACK = 48;

/** Currently active bar color — updated by branding system */
let currentBarColor = DEFAULT_BAR_COLOR;

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

const getNativePlatform = (): string | null => {
  try {
    const cap = (window as any).Capacitor;
    return cap?.getPlatform?.() ?? null;
  } catch {
    return null;
  }
};

function applyAndroidSafeAreaFallbacks() {
  if (getNativePlatform() !== "android") return;

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
  // Sync CSS variable for the pseudo-element masks
  document.documentElement.style.setProperty("--native-bar-color", currentBarColor);
}

async function configureStatusBar() {
  const StatusBar = getStatusBarPlugin();
  if (!StatusBar) {
    console.warn("[NativeUI] StatusBar plugin not found on bridge");
    return;
  }

  await StatusBar.setOverlaysWebView({ overlay: false });
  await StatusBar.setStyle({ style: "DARK" });
  await StatusBar.setBackgroundColor({ color: currentBarColor });
}

async function configureNavigationBar() {
  const NavigationBar = getNavigationBarPlugin();
  if (!NavigationBar) {
    console.warn("[NativeUI] NavigationBar plugin not found on bridge");
    return;
  }

  if (typeof NavigationBar.setNavigationBarColor === "function") {
    await NavigationBar.setNavigationBarColor({
      color: currentBarColor,
      darkButtons: false,
    });
    return;
  }

  if (typeof NavigationBar.setColor === "function") {
    await NavigationBar.setColor({
      color: currentBarColor,
      darkButtons: false,
    });
    return;
  }

  console.warn("[NativeUI] NavigationBar plugin found but no color method available");
}

/**
 * Configure native status bar and navigation bar appearance.
 * Uses the org's primary color for a branded look.
 * Retries if the bridge isn't ready immediately (remote URL loading).
 */
export async function configureNativeBars(color?: string) {
  if (color) {
    currentBarColor = color;
  }

  const platform = getNativePlatform();
  if (platform === "web") {
    // Still update CSS variable for PWA meta-theme consistency
    document.documentElement.style.setProperty("--native-bar-color", currentBarColor);
    return;
  }
  if (!platform && !isCapacitorNative()) return;

  const bridgeReady = await waitForBridge();
  if (!bridgeReady) {
    console.warn("[NativeUI] Capacitor bridge not available after waiting");
    return;
  }

  applyAndroidSafeAreaFallbacks();
  applyNativeBarColorFallback();

  try {
    await configureStatusBar();
    console.log("[NativeUI] Status bar configured with color:", currentBarColor);
  } catch (err) {
    console.error("[NativeUI] StatusBar config error:", err);
  }

  try {
    await configureNavigationBar();
    console.log("[NativeUI] Navigation bar configured with color:", currentBarColor);
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

/**
 * Update native bar colors dynamically (e.g. when org branding changes).
 * Safe to call from React components — no-ops gracefully on web.
 */
export async function updateNativeBarColor(color: string) {
  currentBarColor = color;
  document.documentElement.style.setProperty("--native-bar-color", color);

  const platform = getNativePlatform();
  if (platform === "web" || (!platform && !isCapacitorNative())) return;

  try { await configureStatusBar(); } catch {}
  try { await configureNavigationBar(); } catch {}
}

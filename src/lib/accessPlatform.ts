import { Capacitor } from "@capacitor/core";

export type AccessPlatform =
  | "app_ios"
  | "app_android"
  | "browser_ios"
  | "browser_android"
  | "browser_desktop";

/** Detecta de onde o acesso está sendo feito (app instalado x navegador). */
export const detectAccessPlatform = (): AccessPlatform => {
  try {
    if (Capacitor.isNativePlatform()) {
      const p = Capacitor.getPlatform();
      if (p === "ios") return "app_ios";
      if (p === "android") return "app_android";
    }
  } catch {
    // ignora: ambiente sem bridge nativa
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/android/i.test(ua)) return "browser_android";
  if (/iphone|ipad|ipod/i.test(ua)) return "browser_ios";
  // iPadOS recente se identifica como Mac com toque
  if (/macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1) {
    return "browser_ios";
  }
  return "browser_desktop";
};

export const ACCESS_PLATFORM_LABEL: Record<AccessPlatform, string> = {
  app_ios: "Aplicativo iPhone",
  app_android: "Aplicativo Android",
  browser_ios: "Navegador iPhone",
  browser_android: "Navegador Android",
  browser_desktop: "Navegador computador",
};

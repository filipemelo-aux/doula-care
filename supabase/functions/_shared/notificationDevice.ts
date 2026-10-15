export type NotificationDevice = "all" | "browser" | "android" | "ios";

export function isNotificationDevice(value: unknown): value is NotificationDevice {
  return value === "all" || value === "browser" || value === "android" || value === "ios";
}

/** Aceita "all", um único dispositivo ou uma lista separada por vírgulas ("browser,android"). */
export function isNotificationDeviceList(value: unknown): value is string | string[] {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? [value] : null;
  if (!parts || parts.length === 0) return false;
  return parts.every((p) => isNotificationDevice(typeof p === "string" ? p.trim() : p));
}

/** Normaliza a entrada em uma lista de dispositivos; "all" vence qualquer combinação. */
export function parseNotificationDevices(value: string | string[]): NotificationDevice[] {
  const raw = (Array.isArray(value) ? value : value.split(","))
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p): p is NotificationDevice => isNotificationDevice(p));
  if (raw.includes("all")) return ["all"];
  return [...new Set(raw)];
}

function matchesSingleDevice(
  subscription: { token_type: string; device_type: string | null },
  target: NotificationDevice,
): boolean {
  if (target === "all") return true;
  const device = (subscription.device_type ?? "").toLowerCase();
  const native = subscription.token_type === "fcm";
  const android = (native && ["android", "android_capacitor"].includes(device)) || device === "android_twa";
  const ios = native && ["ios", "ios_capacitor"].includes(device);
  if (target === "android") return android;
  if (target === "ios") return ios;
  return !native && !android;
}

export function matchesNotificationDevice(
  subscription: { token_type: string; device_type: string | null },
  target: NotificationDevice | NotificationDevice[],
): boolean {
  const targets = Array.isArray(target) ? target : [target];
  if (targets.includes("all")) return true;
  return targets.some((t) => matchesSingleDevice(subscription, t));
}

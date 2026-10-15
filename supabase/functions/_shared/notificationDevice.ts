export type NotificationDevice = "all" | "browser" | "android" | "ios";

export function isNotificationDevice(value: unknown): value is NotificationDevice {
  return value === "all" || value === "browser" || value === "android" || value === "ios";
}

export function matchesNotificationDevice(
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
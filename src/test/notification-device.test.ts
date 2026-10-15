import { describe, expect, it } from "vitest";
import { isNotificationDevice, matchesNotificationDevice } from "../../supabase/functions/_shared/notificationDevice";

describe("notification device targeting", () => {
  const subscriptions = [
    { token_type: "fcm", device_type: "android_capacitor" },
    { token_type: "fcm", device_type: "ios_capacitor" },
    { token_type: "web_push", device_type: "android_browser" },
    { token_type: "web_push", device_type: "ios" },
    { token_type: "web_push", device_type: "desktop" },
    { token_type: "web_push", device_type: "android_twa" },
  ];
  it("groups all browsers without mixing native apps", () => {
    expect(subscriptions.filter(s => matchesNotificationDevice(s, "browser"))).toEqual(subscriptions.slice(2, 5));
  });
  it("targets Android native and installed TWA only", () => {
    expect(subscriptions.filter(s => matchesNotificationDevice(s, "android"))).toEqual([subscriptions[0], subscriptions[5]]);
  });
  it("targets iOS native without Safari", () => {
    expect(subscriptions.filter(s => matchesNotificationDevice(s, "ios"))).toEqual([subscriptions[1]]);
  });
  it("keeps all subscriptions for all devices", () => {
    expect(subscriptions.every(s => matchesNotificationDevice(s, "all"))).toBe(true);
  });
  it("rejects unknown devices", () => {
    expect(isNotificationDevice("desktop")).toBe(false);
    expect(isNotificationDevice(null)).toBe(false);
  });
});
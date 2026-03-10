/**
 * Capacitor native push notification utilities.
 * Uses @capacitor/push-notifications for FCM-based native push.
 */
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

/** Returns true when running inside a Capacitor native shell */
export const isCapacitorNative = () => Capacitor.isNativePlatform();

/**
 * Request permission and register for native push notifications.
 * Saves the FCM token to push_subscriptions with token_type = 'fcm'.
 * Returns the FCM token on success, null on failure.
 */
export async function registerNativePush(): Promise<string | null> {
  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.log("[NativePush] Permission denied");
      return null;
    }

    // Register with FCM
    await PushNotifications.register();

    // Wait for registration token
    return new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        console.error("[NativePush] Registration timeout");
        resolve(null);
      }, 10000);

      PushNotifications.addListener("registration", async (token) => {
        clearTimeout(timeout);
        console.log("[NativePush] FCM token received:", token.value.substring(0, 20) + "...");

        // Save to database
        const saved = await saveFcmToken(token.value);
        resolve(saved ? token.value : null);
      });

      PushNotifications.addListener("registrationError", (error) => {
        clearTimeout(timeout);
        console.error("[NativePush] Registration error:", error);
        resolve(null);
      });
    });
  } catch (err) {
    console.error("[NativePush] Error:", err);
    return null;
  }
}

/**
 * Save the FCM token to the push_subscriptions table.
 */
async function saveFcmToken(token: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("[NativePush] User not authenticated");
      return false;
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: token,
        // FCM tokens don't use VAPID keys, store placeholders
        p256dh: "fcm_native",
        auth: "fcm_native",
        device_type: "android_capacitor",
        token_type: "fcm",
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      console.error("[NativePush] DB save error:", error);
      return false;
    }

    console.log("[NativePush] Token saved successfully");
    return true;
  } catch (err) {
    console.error("[NativePush] saveFcmToken error:", err);
    return false;
  }
}

/**
 * Unregister native push and remove token from DB.
 */
export async function unregisterNativePush(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .eq("token_type", "fcm");
    }
    // Note: Capacitor doesn't provide an unregister method,
    // but removing from DB prevents delivery
  } catch (err) {
    console.error("[NativePush] unregister error:", err);
  }
}

/**
 * Set up notification click handler for deep linking.
 */
export function setupNativePushListeners() {
  if (!isCapacitorNative()) return;

  // Handle notification received while app is in foreground
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[NativePush] Foreground notification:", notification.title);
    // Let the OS handle it — we could show an in-app toast here if desired
  });

  // Handle notification tap (app opened from notification)
  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification.data;
    if (data?.url) {
      // Navigate to the deep link URL
      const url = data.url.startsWith("/") ? data.url : `/${data.url}`;
      window.location.href = url + (url.includes("?") ? "&" : "?") + "from_notification=1";
    }
  });
}

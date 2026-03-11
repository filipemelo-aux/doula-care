/**
 * Capacitor native push notification utilities.
 * Uses dynamic imports to avoid build errors in web-only environments.
 */
import { supabase } from "@/integrations/supabase/client";

/** Returns true when running inside a Capacitor native shell */
export const isCapacitorNative = (): boolean => {
  try {
    const cap = (window as any).Capacitor;
    return cap?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
};

/** Lazy-load PushNotifications plugin — hidden from Rollup static analysis */
const getPushPlugin = async () => {
  const modName = "@capacitor/" + "push-notifications";
  const mod = await (Function("m", "return import(m)")(modName) as Promise<any>);
  return mod.PushNotifications;
};

const mapNativePermission = (receive?: string): NotificationPermission => {
  if (receive === "granted") return "granted";
  if (receive === "denied") return "denied";
  return "default";
};

/** Read native push permission state */
export async function getNativePushPermission(): Promise<NotificationPermission> {
  if (!isCapacitorNative()) return "default";

  try {
    const PushNotifications = await getPushPlugin();
    const permission = await PushNotifications.checkPermissions?.();
    return mapNativePermission(permission?.receive);
  } catch (err) {
    console.error("[NativePush] checkPermissions error:", err);
    return "default";
  }
}

/**
 * Request permission and register for native push notifications.
 * Saves the FCM token to push_subscriptions with token_type = 'fcm'.
 * Returns the FCM token on success, null on failure.
 */
export async function registerNativePush(): Promise<string | null> {
  try {
    const PushNotifications = await getPushPlugin();

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.log("[NativePush] Permission denied");
      return null;
    }

    await PushNotifications.register();

    return new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        console.error("[NativePush] Registration timeout");
        resolve(null);
      }, 10000);

      PushNotifications.addListener("registration", async (token) => {
        clearTimeout(timeout);
        console.log("[NativePush] FCM token received:", token.value.substring(0, 20) + "...");
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
  } catch (err) {
    console.error("[NativePush] unregister error:", err);
  }
}

/**
 * Set up notification click handler for deep linking.
 */
export async function setupNativePushListeners() {
  if (!isCapacitorNative()) return;

  try {
    const PushNotifications = await getPushPlugin();

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[NativePush] Foreground notification:", notification.title);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = action.notification.data;
      if (data?.url) {
        const url = data.url.startsWith("/") ? data.url : `/${data.url}`;
        window.location.href = url + (url.includes("?") ? "&" : "?") + "from_notification=1";
      }
    });
  } catch (err) {
    console.error("[NativePush] setupListeners error:", err);
  }
}

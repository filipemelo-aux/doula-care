/**
 * Capacitor native push notification utilities.
 * Accesses plugins via the Capacitor bridge (window.Capacitor.Plugins)
 * since the app loads a remote URL and npm dynamic imports won't work.
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

/** Get PushNotifications plugin from the Capacitor bridge */
const getPushPlugin = () => {
  try {
    const cap = (window as any).Capacitor;
    const plugin = cap?.Plugins?.PushNotifications;
    if (!plugin) {
      console.error("[NativePush] PushNotifications plugin not available on bridge");
      return null;
    }
    return plugin;
  } catch (err) {
    console.error("[NativePush] Error accessing plugin:", err);
    return null;
  }
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
    const PushNotifications = getPushPlugin();
    if (!PushNotifications) return "default";
    const permission = await PushNotifications.checkPermissions();
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
    const PushNotifications = getPushPlugin();
    if (!PushNotifications) {
      console.error("[NativePush] Plugin not available");
      return null;
    }

    let permission = await PushNotifications.checkPermissions();
    if (permission?.receive === "prompt" || permission?.receive === "prompt-with-rationale") {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission?.receive !== "granted") {
      console.log("[NativePush] Permission denied:", permission?.receive);
      return null;
    }

    type ListenerHandle = { remove?: () => Promise<void> | void };

    return await new Promise<string | null>((resolve) => {
      let settled = false;
      const listeners: ListenerHandle[] = [];

      const finish = async (value: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        await Promise.all(
          listeners.map(async (listener) => {
            try {
              await listener?.remove?.();
            } catch {
              // noop
            }
          })
        );
        resolve(value);
      };

      const timeout = setTimeout(() => {
        console.error("[NativePush] Registration timeout");
        finish(null).catch(console.error);
      }, 12000);

      Promise.resolve(PushNotifications.addListener("registration", async (token: { value: string }) => {
        console.log("[NativePush] FCM token received:", token.value.substring(0, 20) + "...");
        const saved = await saveFcmToken(token.value);
        finish(saved ? token.value : null).catch(console.error);
      }))
        .then((handle: ListenerHandle) => {
          listeners.push(handle);
          return PushNotifications.addListener("registrationError", (error: unknown) => {
            console.error("[NativePush] Registration error:", error);
            finish(null).catch(console.error);
          });
        })
        .then((errorHandle: ListenerHandle) => {
          listeners.push(errorHandle);
          return PushNotifications.register();
        })
        .catch((err: unknown) => {
          console.error("[NativePush] Error during registration setup:", err);
          finish(null).catch(console.error);
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
    const PushNotifications = getPushPlugin();
    if (!PushNotifications) return;

    PushNotifications.addListener("pushNotificationReceived", (notification: any) => {
      console.log("[NativePush] Foreground notification:", notification.title);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action: any) => {
      const data = action.notification.data;
      if (data?.url) {
        const url = data.url.startsWith("/") ? data.url : `/${data.url}`;
        window.location.href = url + (url.includes("?") ? "&" : "?") + "from_notification=1";
      }
    });

    console.log("[NativePush] Listeners registered");
  } catch (err) {
    console.error("[NativePush] setupListeners error:", err);
  }
}

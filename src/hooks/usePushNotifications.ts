import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  isCapacitorNative,
  getNativePushPermission,
  registerNativePush,
  unregisterNativePush,
} from "@/lib/capacitorPush";

// Extend ServiceWorkerRegistration to include pushManager
declare global {
  interface ServiceWorkerRegistration {
    pushManager: PushManager;
  }
}
export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (isCapacitorNative()) {
      // Native Capacitor mode — always supported
      setIsSupported(true);
      setIsSubscribed(false);

      getNativePushPermission()
        .then((nativePermission) => {
          setPermission(nativePermission);
          checkNativeSubscription(nativePermission).catch(console.error);
        })
        .catch((err) => {
          console.error("Error checking native permission:", err);
          setPermission("default");
        });

      return;
    }

    // Web mode — check browser support
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkAndFixSubscription();
    }
  }, []);

  const checkNativeSubscription = async (nativePermission: NotificationPermission) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSubscribed(false);
        return;
      }

      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("token_type", "fcm")
        .limit(1);

      const hasSubscription = !!(data && data.length > 0);
      setIsSubscribed(hasSubscription);

      if (hasSubscription) {
        if (nativePermission === "granted") {
          // Refresh token silently on app start
          registerNativePush().catch(console.error);
        }
        return;
      }

      if (nativePermission !== "granted") return;

      // Permission granted but no FCM token in DB: recover automatically
      const token = await registerNativePush();
      if (token) {
        setIsSubscribed(true);
        setPermission("granted");
      }
    } catch (err) {
      console.error("Error checking native subscription:", err);
    }
  };

  const checkAndFixSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const currentVapidKey = await getVapidPublicKey();

      if (subscription) {
        const storedVapidKey = localStorage.getItem("vapid_public_key");

        if (currentVapidKey && storedVapidKey && currentVapidKey !== storedVapidKey) {
          // VAPID key changed - unsubscribe and re-subscribe
          console.log("VAPID key changed, re-subscribing...");
          await subscription.unsubscribe();
          localStorage.setItem("vapid_public_key", currentVapidKey);
          setIsSubscribed(false);
          if (Notification.permission === "granted") {
            await doSubscribe(currentVapidKey);
          }
        } else {
          if (currentVapidKey && !storedVapidKey) {
            localStorage.setItem("vapid_public_key", currentVapidKey);
          }
          setIsSubscribed(true);
          // Always refresh the subscription on load to keep FCM endpoint alive
          if (currentVapidKey && Notification.permission === "granted") {
            doSubscribe(currentVapidKey).catch(console.error);
          }
        }
      } else {
        setIsSubscribed(false);
        // Auto re-subscribe if permission was already granted but subscription was lost
        if (Notification.permission === "granted" && currentVapidKey) {
          console.log("Subscription lost, auto re-subscribing...");
          await doSubscribe(currentVapidKey);
        }
      }
    } catch (err) {
      console.error("Error checking push subscription:", err);
    }
  };

  const getVapidPublicKey = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("get-vapid-public-key");
      if (error) throw error;
      return data?.publicKey || null;
    } catch (err) {
      console.error("Error fetching VAPID key:", err);
      return null;
    }
  };

  const doSubscribe = async (vapidPublicKey: string): Promise<boolean> => {
    try {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subJson = subscription.toJSON();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("doSubscribe: user not authenticated");
        return false;
      }

      // Detect device type/context
      const ua = navigator.userAgent;
      const isAndroid = /android/i.test(ua);
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const isMobile = /mobile/i.test(ua);
      const isStandaloneLike =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches;
      const isTWALikely = isAndroid && (document.referrer.startsWith("android-app://") || isStandaloneLike);

      let deviceType = "desktop";
      if (isAndroid) deviceType = isTWALikely ? "android_twa" : "android_browser";
      else if (isIOS) deviceType = "ios";
      else if (isMobile) deviceType = "mobile";

      // Save subscription to database
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
          device_type: deviceType,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) {
        console.error("doSubscribe: DB upsert error:", error);
        // Even if DB save fails, the browser subscription is active
        // Don't return false - the notification will still work for this session
      }

      localStorage.setItem("vapid_public_key", vapidPublicKey);
      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Error in doSubscribe:", err);
      return false;
    }
  };

  const subscribe = useCallback(async (): Promise<boolean | "denied"> => {
    if (!isSupported) return false;
    setIsLoading(true);

    try {
      // Capacitor native mode
      if (isCapacitorNative()) {
        const token = await registerNativePush();
        const nativePermission = await getNativePushPermission();
        setPermission(nativePermission);
        setIsLoading(false);

        if (token) {
          setIsSubscribed(true);
          setPermission("granted");
          return true;
        }

        return nativePermission === "denied" ? "denied" : false;
      }

      // Web mode
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setIsLoading(false);
        return "denied";
      }

      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) {
        console.error("VAPID public key not available");
        setIsLoading(false);
        return false;
      }

      const result = await doSubscribe(vapidPublicKey);
      setIsLoading(false);
      return result;
    } catch (err) {
      console.error("Error subscribing to push:", err);
      setIsLoading(false);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isCapacitorNative()) {
        await unregisterNativePush();
      } else {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("user_id", user.id)
              .eq("endpoint", endpoint);
          }
        }
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error("Error unsubscribing:", err);
    }
    setIsLoading(false);
  }, []);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

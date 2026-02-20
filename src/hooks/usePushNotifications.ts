import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkAndFixSubscription();
    }
  }, []);

  const checkAndFixSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Verify the subscription is still valid by checking against current VAPID key
        const currentVapidKey = await getVapidPublicKey();
        const storedVapidKey = localStorage.getItem("vapid_public_key");

        if (currentVapidKey && storedVapidKey && currentVapidKey !== storedVapidKey) {
          // VAPID key changed - unsubscribe and re-subscribe
          console.log("VAPID key changed, re-subscribing...");
          await subscription.unsubscribe();
          localStorage.setItem("vapid_public_key", currentVapidKey);
          setIsSubscribed(false);
          // Auto re-subscribe if permission was already granted
          if (Notification.permission === "granted") {
            await doSubscribe(currentVapidKey);
          }
        } else {
          if (currentVapidKey && !storedVapidKey) {
            localStorage.setItem("vapid_public_key", currentVapidKey);
          }
          setIsSubscribed(true);
        }
      } else {
        setIsSubscribed(false);
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
      if (!user) throw new Error("Not authenticated");

      // Save subscription to database
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      localStorage.setItem("vapid_public_key", vapidPublicKey);
      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Error in doSubscribe:", err);
      return false;
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    setIsLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setIsLoading(false);
        return false;
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

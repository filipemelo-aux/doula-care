import { useEffect, useRef } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface AutoPushPromptProps {
  userId: string;
}

export function AutoPushPrompt({ userId }: AutoPushPromptProps) {
  const { isSupported, isSubscribed, isLoading, subscribe, permission } = usePushNotifications();
  const prompted = useRef(false);

  useEffect(() => {
    if (!isSupported || isSubscribed || isLoading || prompted.current) return;
    if (permission === "denied") return;

    const timer = setTimeout(async () => {
      if (prompted.current) return;
      prompted.current = true;

      // Silently attempt — no error toasts in case it fails (e.g., iframe/preview)
      try {
        await subscribe();
      } catch {
        // Silent fail
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, isLoading, permission, subscribe]);

  return null;
}

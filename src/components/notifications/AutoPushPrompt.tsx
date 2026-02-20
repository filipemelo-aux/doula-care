import { useEffect, useRef } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

interface AutoPushPromptProps {
  userId: string;
}

export function AutoPushPrompt({ userId }: AutoPushPromptProps) {
  const { isSupported, isSubscribed, isLoading, subscribe, permission } = usePushNotifications();
  const prompted = useRef(false);

  useEffect(() => {
    if (!isSupported || isSubscribed || isLoading || prompted.current) return;
    if (permission === "denied") return;

    // Small delay to let the page settle after login
    const timer = setTimeout(async () => {
      if (prompted.current) return;
      prompted.current = true;

      const success = await subscribe();
      if (success) {
        toast.success("Notificações ativadas! Você receberá alertas importantes.");
      } else {
        // Silently fail - user dismissed or something went wrong
        console.log("Push notification auto-prompt was not accepted");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, isLoading, permission, subscribe]);

  return null;
}

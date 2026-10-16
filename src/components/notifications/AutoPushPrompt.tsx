import { useEffect, useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PushPermissionModal } from "@/components/notifications/PushPermissionModal";

interface AutoPushPromptProps {
  userId: string;
}

export function AutoPushPrompt({ userId }: AutoPushPromptProps) {
  const { isSupported, isSubscribed, isLoading, permission } = usePushNotifications();
  const { limits } = usePlanLimits();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!isSupported || isSubscribed || isLoading) return;
    if (!limits.pushNotifications) return; // Plan doesn't support push
    if (permission === "denied") return;
    if (permission === "granted") return; // Already granted but not subscribed - will be handled by hook
    
    // Check if user already dismissed
    const dismissed = localStorage.getItem(`push_prompt_dismissed_${userId}`);
    if (dismissed) return;

    // Check if running as standalone PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    // Show modal after a short delay
    // Espera outras janelas (ex.: boas-vindas) fecharem antes de abrir.
    let timer: ReturnType<typeof setTimeout>;
    const tryOpen = () => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) {
        timer = setTimeout(tryOpen, 1000);
        return;
      }
      setShowModal(true);
    };
    timer = setTimeout(tryOpen, isStandalone ? 1500 : 3000);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, isLoading, permission, userId]);

  return (
    <PushPermissionModal
      open={showModal}
      onOpenChange={setShowModal}
    />
  );
}

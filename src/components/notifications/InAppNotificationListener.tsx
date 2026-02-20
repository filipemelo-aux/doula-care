import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, AlertTriangle } from "lucide-react";

interface InAppNotificationListenerProps {
  userId: string;
  role: "client" | "admin";
  clientId?: string;
}

export function InAppNotificationListener({ userId, role, clientId }: InAppNotificationListenerProps) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (role === "client" && !clientId) return;

    const channel = supabase
      .channel(`in-app-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_notifications",
          ...(role === "client" && clientId ? { filter: `client_id=eq.${clientId}` } : {}),
        },
        (payload) => {
          const notification = payload.new as {
            title: string;
            message: string;
            id: string;
          };

          const isUrgent =
            notification.title?.toLowerCase().includes("parto") ||
            notification.title?.toLowerCase().includes("urgente") ||
            notification.title?.includes("🚨");

          toast(notification.title, {
            description: notification.message,
            duration: isUrgent ? 30000 : 10000,
            icon: isUrgent ? (
              <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
            ) : (
              <Bell className="h-5 w-5 text-primary" />
            ),
            className: isUrgent
              ? "border-2 border-destructive bg-destructive/10 shadow-lg shadow-destructive/20"
              : "border-2 border-primary/30 shadow-lg",
            action: {
              label: "Ver",
              onClick: () => {
                // Navigate to messages for clients, dashboard for admins
                if (role === "client") {
                  window.location.href = "/gestante/mensagens";
                } else {
                  window.location.href = "/admin";
                }
              },
            },
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, role, clientId]);

  return null;
}

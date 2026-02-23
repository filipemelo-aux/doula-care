import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, AlertTriangle, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InAppNotificationListenerProps {
  userId: string;
  role: "client" | "admin";
  clientId?: string;
  organizationId?: string | null;
}

export function InAppNotificationListener({ userId, role, clientId, organizationId }: InAppNotificationListenerProps) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const contractionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Listen for new contractions (admin only) to offer labor registration
  useEffect(() => {
    if (role !== "admin") return;

    const channel = supabase
      .channel(`admin-contraction-alerts-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contractions",
        },
        async (payload) => {
          const contraction = payload.new as { client_id: string };

          // Check if this client already has labor started
          const { data: clientData } = await supabase
            .from("clients")
            .select("id, full_name, labor_started_at")
            .eq("id", contraction.client_id)
            .maybeSingle();

          if (!clientData || clientData.labor_started_at) return;

          // First contraction without labor started — offer to register
          toast(
            `⏱️ ${clientData.full_name} registrou uma contração`,
            {
              description: "Deseja registrar que o trabalho de parto iniciou?",
              duration: 60000,
              icon: <Baby className="h-5 w-5 text-primary" />,
              className: "border-2 border-primary/40 shadow-lg",
              action: {
                label: "Registrar Parto",
                onClick: async () => {
                  const { error } = await supabase
                    .from("clients")
                    .update({ labor_started_at: new Date().toISOString() })
                    .eq("id", clientData.id);

                  if (error) {
                    toast.error("Erro ao registrar trabalho de parto");
                    return;
                  }

                  // Send notification to the client
                  await supabase.from("client_notifications").insert({
                    client_id: clientData.id,
                    title: "💕 Seu bebê está a caminho!",
                    message: "Sua Doula registrou que o trabalho de parto começou. Respire fundo, confie no seu corpo. Estarei com você!",
                    organization_id: organizationId || null,
                  });

                  toast.success(`Trabalho de parto registrado para ${clientData.full_name}`, {
                    icon: <Baby className="h-5 w-5 text-primary" />,
                  });
                },
              },
            }
          );
        }
      )
      .subscribe();

    contractionChannelRef.current = channel;

    return () => {
      if (contractionChannelRef.current) {
        supabase.removeChannel(contractionChannelRef.current);
      }
    };
  }, [userId, role]);

  // Listen for client_notifications inserts (client only — admins use NotificationsCenter)
  useEffect(() => {
    if (role !== "client" || !clientId) return;

    const channel = supabase
      .channel(`in-app-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_notifications",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const notification = payload.new as {
            title: string;
            message: string;
            id: string;
          };

          // Skip admin-only notifications (budget responses) from showing as client toasts
          const isBudgetResponse =
            notification.title?.includes("Orçamento Aceito") ||
            notification.title?.includes("Orçamento Recusado") ||
            notification.title?.includes("✅ Orçamento") ||
            notification.title?.includes("❌ Orçamento");

          if (isBudgetResponse) return;

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
                window.location.href = "/gestante/mensagens";
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

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, AlertTriangle, Baby } from "lucide-react";

import { ClientContractionsDialog } from "@/components/dashboard/ClientContractionsDialog";
import { Tables } from "@/integrations/supabase/types";
import { sendPushNotification } from "@/lib/pushNotifications";

type Client = Tables<"clients">;

interface InAppNotificationListenerProps {
  userId: string;
  role: "client" | "admin";
  clientId?: string;
  organizationId?: string | null;
  onNavigate?: (path: string) => void;
}

export function InAppNotificationListener({ userId, role, clientId, organizationId, onNavigate }: InAppNotificationListenerProps) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const contractionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [contractionsClient, setContractionsClient] = useState<Client | null>(null);
  const [contractionsDialogOpen, setContractionsDialogOpen] = useState(false);

  const openContractionsHistory = useCallback((client: Client) => {
    setContractionsClient(client);
    setContractionsDialogOpen(true);
  }, []);

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
          ...(organizationId ? { filter: `organization_id=eq.${organizationId}` } : {}),
        },
        async (payload) => {
          const contraction = payload.new as { client_id: string };

          // Check if this client already has labor started
          const { data: clientData } = await supabase
            .from("clients")
            .select("id, full_name, labor_started_at, user_id")
            .eq("id", contraction.client_id)
            .maybeSingle();

          if (!clientData || clientData.labor_started_at) return;

          // First contraction without labor started — offer to register
          // Use fixed toast ID per client so only latest contraction shows
          const toastId = `contraction-${clientData.id}`;
          
          toast(
            `⏱️ ${clientData.full_name} registrou uma contração`,
            {
              id: toastId,
              description: "Deseja registrar que o trabalho de parto iniciou?",
              duration: 60000,
              icon: <Baby className="h-5 w-5 text-primary" />,
              className: "border-2 border-primary/40 shadow-lg [&_[data-content]]:!max-w-full",
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

                  await supabase.from("client_notifications").insert({
                    client_id: clientData.id,
                    title: "💕 Seu bebê está a caminho!",
                    message: "Sua Doula registrou que o trabalho de parto começou. Respire fundo, confie no seu corpo. Estarei com você!",
                    organization_id: organizationId || null,
                  });

                  // Send push to client
                  if (clientData.user_id) {
                    sendPushNotification({
                      user_ids: [clientData.user_id],
                      title: "💕 Seu bebê está a caminho!",
                      message: "Sua Doula registrou que o trabalho de parto começou. Respire fundo!",
                      url: "/gestante",
                      tag: "labor-started-client",
                      type: "labor_started",
                      priority: "critica",
                      require_interaction: true,
                    });
                  }

                  toast.success(`Trabalho de parto registrado para ${clientData.full_name}`, {
                    icon: <Baby className="h-5 w-5 text-primary" />,
                  });
                },
              },
              cancel: {
                label: "Aguardar",
                onClick: () => {
                  // Open contractions history on dismiss
                  openContractionsHistory(clientData as Client);
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
  }, [userId, role, organizationId, openContractionsHistory]);

  // Listen for new appointment requests (admin only)
  useEffect(() => {
    if (role !== "admin" || !organizationId) return;

    const channel = supabase
      .channel(`admin-appointment-requests-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointment_requests",
          filter: `organization_id=eq.${organizationId}`,
        },
        async (payload) => {
          const request = payload.new as { client_id: string; requested_date: string; requested_time: string };
          
          const { data: clientData } = await supabase
            .from("clients")
            .select("full_name")
            .eq("id", request.client_id)
            .maybeSingle();

          if (clientData) {
            toast(`📅 ${clientData.full_name} solicitou uma consulta`, {
              description: `${request.requested_date} às ${request.requested_time?.slice(0, 5)}`,
              duration: 15000,
              icon: <Bell className="h-5 w-5 text-primary" />,
              className: "border-2 border-primary/30 shadow-lg",
              action: {
                label: "Ver Agenda",
                onClick: () => {
                  if (onNavigate) onNavigate("/agenda");
                  else window.location.href = "/agenda";
                },
              },
            });

            // Send push to admins
            sendPushNotification({
              send_to_admins: true,
              title: `📅 Solicitação de Consulta`,
              message: `${clientData.full_name} solicitou consulta para ${request.requested_date} às ${request.requested_time?.slice(0, 5)}`,
              url: "/agenda",
              tag: "appointment-request",
              type: "appointment_reminder",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role, organizationId]);

  // Listen for client_notifications inserts (admin — new messages from clients)
  useEffect(() => {
    if (role !== "admin") return;

    const channel = supabase
      .channel(`admin-client-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "client_notifications",
          ...(organizationId ? { filter: `organization_id=eq.${organizationId}` } : {}),
        },
        async (payload) => {
          const notification = payload.new as {
            title: string;
            message: string;
            client_id: string;
            id: string;
          };

          // Only show notifications that are messages from clients (not system-generated ones for clients)
          const isClientMessage = notification.title?.startsWith("Mensagem de ");
          if (!isClientMessage) return;

          toast(notification.title, {
            description: notification.message?.substring(0, 100),
            duration: 10000,
            icon: <Bell className="h-5 w-5 text-primary" />,
            className: "border-2 border-primary/30 shadow-lg",
            action: {
              label: "Ver",
              onClick: () => {
                if (onNavigate) onNavigate(`/mensagens?clientId=${notification.client_id}`);
                else window.location.href = `/mensagens?clientId=${notification.client_id}`;
              },
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role, organizationId]);

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

          // Skip notifications that are NOT meant for the client:
          // 1. Budget responses (admin-only)
          // 2. Messages FROM the client (they are the sender, no need to toast)
          // 3. Labor/contraction alerts meant for admins
          const title = notification.title || "";
          const isAdminOnly =
            title.includes("Orçamento Aceito") ||
            title.includes("Orçamento Recusado") ||
            title.includes("✅ Orçamento") ||
            title.includes("❌ Orçamento") ||
            title.startsWith("Mensagem de ") ||
            title.includes("TRABALHO DE PARTO INICIADO") ||
            title.includes("registrou uma contração");

          if (isAdminOnly) return;

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
                if (onNavigate) onNavigate("/gestante/mensagens");
                else window.location.href = "/gestante/mensagens";
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

  return (
    <ClientContractionsDialog
      open={contractionsDialogOpen}
      onOpenChange={setContractionsDialogOpen}
      client={contractionsClient}
    />
  );
}

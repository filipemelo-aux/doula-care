import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Bell, Users2, Baby, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface TopNotification {
  id: string;
  dbId: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  priority: "high" | "medium" | "low";
}

export function GestanteNotificationBanner() {
  const { client } = useGestanteAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [sessionDismissedIds, setSessionDismissedIds] = useState<Set<string>>(new Set());

  const { data: topNotification } = useQuery({
    queryKey: ["gestante-top-notification", client?.id],
    queryFn: async (): Promise<TopNotification | null> => {
      if (!client?.id) return null;

      const { data: unread } = await supabase
        .from("client_notifications")
        .select("id, title, message, created_at")
        .eq("client_id", client.id)
        .eq("read_by_client", false)
        .order("created_at", { ascending: false })
        .limit(1);

      if (unread && unread.length > 0) {
        const n = unread[0];
        const isCommunity = n.title?.includes("Comunidade");
        const isLabor = n.title?.includes("parto") || n.title?.includes("bebê");
        return {
          id: `cn-${n.id}`,
          dbId: n.id,
          type: isCommunity ? "community" : isLabor ? "labor" : "general",
          title: n.title,
          message: n.message,
          timestamp: n.created_at,
          priority: isLabor ? "high" : "low",
        };
      }

      return null;
    },
    enabled: !!client?.id,
    refetchInterval: 30000,
  });

  // Realtime refresh
  useEffect(() => {
    if (!client?.id) return;
    const channel = supabase
      .channel("gestante-banner-refresh")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "client_notifications",
        filter: `client_id=eq.${client.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["gestante-top-notification"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [client?.id, queryClient]);

  if (!topNotification || sessionDismissedIds.has(topNotification.id)) return null;

  const markAsRead = async (dbId: string) => {
    await supabase
      .from("client_notifications")
      .update({ read_by_client: true })
      .eq("id", dbId);
    queryClient.invalidateQueries({ queryKey: ["gestante-top-notification"] });
    queryClient.invalidateQueries({ queryKey: ["gestante-unread-messages"] });
  };

  const handleDismiss = () => {
    // Session-only dismiss (comes back on refresh)
    setSessionDismissedIds((prev) => new Set([...prev, topNotification.id]));
  };

  const isPaymentNotification = (n: TopNotification) =>
    n.title?.toLowerCase().includes("pagamento") ||
    n.title?.toLowerCase().includes("parcela") ||
    n.title?.toLowerCase().includes("cobrança") ||
    n.title?.toLowerCase().includes("venciment") ||
    n.message?.toLowerCase().includes("pagamento") ||
    n.message?.toLowerCase().includes("parcela");

  const isAppointmentNotification = (n: TopNotification) =>
    n.title?.toLowerCase().includes("consulta") ||
    n.title?.toLowerCase().includes("compromisso") ||
    n.title?.toLowerCase().includes("agendamento") ||
    n.message?.toLowerCase().includes("consulta confirmad") ||
    n.message?.toLowerCase().includes("consulta cancelad") ||
    n.message?.toLowerCase().includes("consulta agendad");

  const getNotificationRoute = (n: TopNotification): string | null => {
    if (n.type === "community") return "/gestante/comunidade";
    if (isPaymentNotification(n)) return "/gestante/perfil?tab=plano&overdue=true";
    if (isAppointmentNotification(n)) return "/gestante/consultas";
    return null;
  };

  const handleReadAndNavigate = async () => {
    // Mark as read in DB (permanent dismiss)
    await markAsRead(topNotification.dbId);

    const route = getNotificationRoute(topNotification);
    if (route) {
      navigate(route);
    }
    // If no route, banner simply closes (already marked as read so won't reappear)
  };

  const actionLabel = getNotificationRoute(topNotification) ? "Ver detalhes →" : "Entendi ✓";

  const iconMap: Record<string, typeof Bell> = {
    community: Users2,
    labor: Baby,
    general: Bell,
  };

  const colorMap: Record<string, string> = {
    labor: "border-red-500/30 bg-gradient-to-r from-red-50/80 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10",
    community: "border-emerald-500/30 bg-gradient-to-r from-emerald-50/80 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10",
    general: "border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5",
  };

  const textColorMap: Record<string, string> = {
    labor: "text-red-700 dark:text-red-400",
    community: "text-emerald-700 dark:text-emerald-400",
    general: "text-primary",
  };

  const Icon = iconMap[topNotification.type] || Bell;
  const alertColor = colorMap[topNotification.type] || "";
  const titleColor = textColorMap[topNotification.type] || "text-foreground";

  const timeAgo = formatDistanceToNow(new Date(topNotification.timestamp), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Alert className={`${alertColor} relative pr-16 mb-3`}>
      <Icon className={`h-4 w-4 ${titleColor}`} />
      <AlertTitle className={`${titleColor} text-sm font-semibold`}>
        {topNotification.title}
      </AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground">
        {topNotification.message}{" "}
        <span className="opacity-60">• {timeAgo}</span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 ml-2 text-xs"
          onClick={handleReadAndNavigate}
        >
          {actionLabel}
        </Button>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 min-w-0 !pl-0 !pr-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleDismiss}
        title="Fechar temporariamente"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </Alert>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Bell, Baby, BookHeart, Sparkles, CalendarCheck, X, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { markNotificationSeen, getNotificationSeenAt } from "@/lib/notificationSeen";

interface TopNotification {
  id: string;
  dbId: string;
  dbTable: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  priority: "high" | "medium" | "low";
}

const BANNER_STORAGE_KEY = "admin-banner-dismiss";

export function NotificationTopBanner() {
  const { organizationId, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch permanently dismissed IDs from DB
  const { data: dismissedIds = new Set<string>() } = useQuery({
    queryKey: ["admin-banner-dismissed", user?.id],
    queryFn: async () => {
      if (!user?.id) return new Set<string>();
      const { data } = await supabase
        .from("notification_seen")
        .select("section")
        .eq("user_id", user.id)
        .eq("storage_key", BANNER_STORAGE_KEY);
      return new Set((data || []).map((r) => r.section));
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const { data: topNotification } = useQuery({
    queryKey: ["top-notification-banner", organizationId],
    queryFn: async (): Promise<TopNotification | null> => {
      const { data: laborClients } = await supabase
        .from("clients")
        .select("id, full_name, labor_started_at")
        .eq("status", "gestante")
        .eq("birth_occurred", false)
        .not("labor_started_at", "is", null)
        .order("labor_started_at", { ascending: false })
        .limit(1);

      if (laborClients && laborClients.length > 0) {
        const c = laborClients[0];
        return {
          id: `labor-${c.id}`,
          dbId: c.id,
          dbTable: "clients",
          type: "labor",
          title: "🚨 Trabalho de Parto",
          message: `${c.full_name} iniciou o trabalho de parto`,
          timestamp: c.labor_started_at!,
          priority: "high",
        };
      }

      const { data: pendingSvc } = await supabase
        .from("service_requests")
        .select("id, service_type, created_at, clients(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingSvc && pendingSvc.length > 0) {
        const s = pendingSvc[0];
        const clientName = (s.clients as any)?.full_name || "Cliente";
        return {
          id: `svc-${s.id}`,
          dbId: s.id,
          dbTable: "service_requests",
          type: "service_request",
          title: "Solicitação de Serviço",
          message: `${clientName} solicitou: ${s.service_type}`,
          timestamp: s.created_at,
          priority: "medium",
        };
      }

      const { data: pendingApt } = await supabase
        .from("appointment_requests")
        .select("id, requested_date, requested_time, created_at, clients(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingApt && pendingApt.length > 0) {
        const a = pendingApt[0];
        const clientName = (a.clients as any)?.full_name || "Cliente";
        return {
          id: `aptreq-${a.id}`,
          dbId: a.id,
          dbTable: "appointment_requests",
          type: "appointment_request",
          title: "Solicitação de Consulta",
          message: `${clientName} pediu consulta em ${a.requested_date.split("-").reverse().join("/")} às ${a.requested_time?.slice(0, 5)}`,
          timestamp: a.created_at,
          priority: "medium",
        };
      }

      const { data: unreadDiary } = await supabase
        .from("pregnancy_diary")
        .select("id, created_at, clients(full_name)")
        .eq("read_by_admin", false)
        .order("created_at", { ascending: false })
        .limit(1);

      if (unreadDiary && unreadDiary.length > 0) {
        const d = unreadDiary[0];
        const clientName = (d.clients as any)?.full_name || "Cliente";
        return {
          id: `diary-${d.id}`,
          dbId: d.id,
          dbTable: "pregnancy_diary",
          type: "diary",
          title: "Novo Diário",
          message: `${clientName} escreveu no diário`,
          timestamp: d.created_at,
          priority: "low",
        };
      }

      const { data: unreadCommunity } = await supabase
        .from("org_notifications")
        .select("id, title, message, created_at")
        .eq("type", "community")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(1);

      if (unreadCommunity && unreadCommunity.length > 0) {
        const c = unreadCommunity[0];
        return {
          id: `community-${c.id}`,
          dbId: c.id,
          dbTable: "org_notifications",
          type: "community",
          title: c.title,
          message: c.message,
          timestamp: c.created_at,
          priority: "low",
        };
      }

      return null;
    },
    enabled: !!organizationId,
    refetchInterval: 30000,
  });

  // Realtime refresh
  useEffect(() => {
    const channel = supabase
      .channel("top-banner-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        queryClient.invalidateQueries({ queryKey: ["top-notification-banner"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["top-notification-banner"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["top-notification-banner"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pregnancy_diary" }, () => {
        queryClient.invalidateQueries({ queryKey: ["top-notification-banner"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "org_notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["top-notification-banner"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (!topNotification || dismissedIds.has(topNotification.id)) return null;

  const handleDismiss = async () => {
    if (!user?.id) return;
    // Permanently dismiss this banner in DB — notification stays active in its area
    await markNotificationSeen(BANNER_STORAGE_KEY, topNotification.id, user.id);
    queryClient.invalidateQueries({ queryKey: ["admin-banner-dismissed"] });
    queryClient.invalidateQueries({ queryKey: ["top-notification-banner"] });
  };

  const handleReadAndNavigate = async () => {
    // Mark as read AND dismiss banner permanently
    try {
      if (topNotification.dbTable === "pregnancy_diary") {
        await supabase.from("pregnancy_diary").update({ read_by_admin: true }).eq("id", topNotification.dbId);
      } else if (topNotification.dbTable === "org_notifications") {
        await supabase.from("org_notifications").update({ read: true }).eq("id", topNotification.dbId);
      }
    } catch {}
    if (user?.id) {
      await markNotificationSeen(BANNER_STORAGE_KEY, topNotification.id, user.id);
      queryClient.invalidateQueries({ queryKey: ["admin-banner-dismissed"] });
    }
    queryClient.invalidateQueries({ queryKey: ["top-notification-banner"] });
    const destination = topNotification.type === "community" ? "/comunidade" : "/notificacoes";
    navigate(destination);
  };

  const iconMap: Record<string, typeof Bell> = {
    labor: Baby,
    service_request: Sparkles,
    appointment_request: CalendarCheck,
    diary: BookHeart,
    community: MessageSquare,
  };

  const colorMap: Record<string, string> = {
    labor: "border-red-500/30 bg-gradient-to-r from-red-50/80 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10",
    service_request: "border-none border-30 bg-gradient-to-r from-primary/5 to-accent/5",
    appointment_request: "border-blue-500/30 bg-gradient-to-r from-blue-50/80 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10",
    diary: "border-purple-500/30 bg-gradient-to-r from-purple-50/80 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10",
    community: "border-emerald-500/30 bg-gradient-to-r from-emerald-50/80 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10",
  };

  const textColorMap: Record<string, string> = {
    labor: "text-red-700 dark:text-red-400",
    service_request: "text-primary",
    appointment_request: "text-blue-700 dark:text-blue-400",
    diary: "text-purple-700 dark:text-purple-400",
    community: "text-emerald-700 dark:text-emerald-400",
  };

  const Icon = iconMap[topNotification.type] || Bell;
  const alertColor = colorMap[topNotification.type] || "";
  const titleColor = textColorMap[topNotification.type] || "text-foreground";

  const timeAgo = formatDistanceToNow(new Date(topNotification.timestamp), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Alert className={`${alertColor} relative pr-16`}>
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
          Ver detalhes →
        </Button>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 min-w-0 !pl-0 !pr-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleDismiss}
        title="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </Alert>
  );
}

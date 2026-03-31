import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Bell, Users2, Baby, AlertTriangle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface TopNotification {
  id: string;
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
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("dismissed-gestante-notifications");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const { data: topNotification } = useQuery({
    queryKey: ["gestante-top-notification", client?.id],
    queryFn: async (): Promise<TopNotification | null> => {
      if (!client?.id) return null;

      // Unread client notifications (newest first)
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

  if (!topNotification || dismissedIds.has(topNotification.id)) return null;

  const handleDismiss = () => {
    setDismissedIds((prev) => {
      const next = new Set([...prev, topNotification.id]);
      try {
        localStorage.setItem("dismissed-gestante-notifications", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const isPaymentNotification = (n: TopNotification) =>
    n.title?.toLowerCase().includes("pagamento") ||
    n.title?.toLowerCase().includes("parcela") ||
    n.title?.toLowerCase().includes("cobrança") ||
    n.title?.toLowerCase().includes("venciment") ||
    n.message?.toLowerCase().includes("pagamento") ||
    n.message?.toLowerCase().includes("parcela");

  const handleReadAndNavigate = () => {
    handleDismiss();
    if (topNotification.type === "community") {
      navigate("/gestante/comunidade");
    } else if (isPaymentNotification(topNotification)) {
      navigate("/gestante/perfil?tab=plano");
    } else {
      navigate("/gestante/mensagens");
    }
  };

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
          Ver detalhes →
        </Button>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 min-w-0 !pl-0 !pr-0 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
        onClick={handleDismiss}
        title="Fechar definitivamente"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </Alert>
  );
}

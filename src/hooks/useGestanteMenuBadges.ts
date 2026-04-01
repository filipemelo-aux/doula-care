import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getGestanteNotificationSeenKey,
  getNotificationSeenAt,
  markNotificationSeen,
} from "@/lib/notificationSeen";

interface MenuBadges {
  consultas: number;
  servicos: number;
  mensagens: number;
}

const FALLBACK_LOOKBACK_MS = 48 * 60 * 60 * 1000;

export function useGestanteMenuBadges(
  clientId: string | undefined,
  userId: string | undefined,
  activePath?: string,
): MenuBadges {
  const queryClient = useQueryClient();
  const seenStorageKey = clientId ? getGestanteNotificationSeenKey(clientId) : null;

  useEffect(() => {
    if (!clientId || !seenStorageKey || !userId) return;

    const section =
      activePath === "/gestante/consultas"
        ? "consultas"
        : activePath === "/gestante/servicos"
          ? "servicos"
          : null;

    if (!section) return;

    markNotificationSeen(seenStorageKey, section, userId);
    queryClient.invalidateQueries({ queryKey: ["gestante-menu-badges", clientId] });
  }, [activePath, clientId, userId, queryClient, seenStorageKey]);

  const { data: badges = { consultas: 0, servicos: 0, mensagens: 0 } } = useQuery({
    queryKey: ["gestante-menu-badges", clientId, activePath],
    queryFn: async (): Promise<MenuBadges> => {
      if (!clientId || !seenStorageKey || !userId) {
        return { consultas: 0, servicos: 0, mensagens: 0 };
      }

      const fallbackSeenAt = new Date(Date.now() - FALLBACK_LOOKBACK_MS).toISOString();
      const [consultasSeenAt, servicosSeenAt] = await Promise.all([
        getNotificationSeenAt(seenStorageKey, "consultas", userId),
        getNotificationSeenAt(seenStorageKey, "servicos", userId),
      ]);
      const effectiveConsultasSeen = consultasSeenAt ?? fallbackSeenAt;
      const effectiveServicosSeen = servicosSeenAt ?? fallbackSeenAt;
      const nowIso = new Date().toISOString();

      const [appointmentsRes, servicesRes, messagesRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .is("completed_at", null)
          .gte("scheduled_at", nowIso)
          .gt("created_at", effectiveConsultasSeen),
        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .in("status", ["budget_sent", "date_proposed", "accepted"])
          .gt("updated_at", effectiveServicosSeen),
        supabase
          .from("client_notifications")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("read_by_client", false)
          .or("title.eq.Mensagem da Doula,title.like.Mensagem de %"),
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (messagesRes.error) throw messagesRes.error;

      return {
        consultas: appointmentsRes.count || 0,
        servicos: servicesRes.count || 0,
        mensagens: messagesRes.count || 0,
      };
    },
    enabled: !!clientId && !!userId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel(`gestante-menu-badges-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `client_id=eq.${clientId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["gestante-menu-badges", clientId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          filter: `client_id=eq.${clientId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["gestante-menu-badges", clientId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_notifications",
          filter: `client_id=eq.${clientId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["gestante-menu-badges", clientId] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, queryClient]);

  return badges;
}

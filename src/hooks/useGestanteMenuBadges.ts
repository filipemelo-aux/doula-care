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
  activePath?: string,
): MenuBadges {
  const queryClient = useQueryClient();
  const seenStorageKey = clientId ? getGestanteNotificationSeenKey(clientId) : null;

  useEffect(() => {
    if (!clientId || !seenStorageKey) return;

    const section =
      activePath === "/gestante/consultas"
        ? "consultas"
        : activePath === "/gestante/servicos"
          ? "servicos"
          : null;

    if (!section) return;

    markNotificationSeen(seenStorageKey, section);
    queryClient.invalidateQueries({ queryKey: ["gestante-menu-badges", clientId] });
  }, [activePath, clientId, queryClient, seenStorageKey]);

  const { data: badges = { consultas: 0, servicos: 0, mensagens: 0 } } = useQuery({
    queryKey: ["gestante-menu-badges", clientId, activePath],
    queryFn: async (): Promise<MenuBadges> => {
      if (!clientId || !seenStorageKey) {
        return { consultas: 0, servicos: 0, mensagens: 0 };
      }

      const fallbackSeenAt = new Date(Date.now() - FALLBACK_LOOKBACK_MS).toISOString();
      const consultasSeenAt = getNotificationSeenAt(seenStorageKey, "consultas") ?? fallbackSeenAt;
      const servicosSeenAt = getNotificationSeenAt(seenStorageKey, "servicos") ?? fallbackSeenAt;
      const nowIso = new Date().toISOString();

      const [appointmentsRes, servicesRes, messagesRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .is("completed_at", null)
          .gte("scheduled_at", nowIso)
          .gt("created_at", consultasSeenAt),
        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .in("status", ["budget_sent", "date_proposed", "accepted"])
          .gt("updated_at", servicosSeenAt),
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
    enabled: !!clientId,
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

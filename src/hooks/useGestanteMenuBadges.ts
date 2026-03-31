import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface MenuBadges {
  consultas: number;
  servicos: number;
  mensagens: number;
}

export function useGestanteMenuBadges(clientId: string | undefined): MenuBadges {
  const queryClient = useQueryClient();

  const { data: badges = { consultas: 0, servicos: 0, mensagens: 0 } } = useQuery({
    queryKey: ["gestante-menu-badges", clientId],
    queryFn: async (): Promise<MenuBadges> => {
      if (!clientId) return { consultas: 0, servicos: 0, mensagens: 0 };

      const today = new Date().toISOString();

      // Upcoming appointments not yet seen (scheduled in the future, created recently)
      const [appointmentsRes, servicesRes, messagesRes] = await Promise.all([
        // Consultas: upcoming appointments (next 48h) that haven't been completed
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .is("completed_at", null)
          .gte("scheduled_at", today)
          .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),

        // Serviços: service requests with recent status changes (budget sent, scheduled, etc.)
        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .in("status", ["budget_sent", "scheduled"])
          .gte("updated_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),

        // Mensagens: unread direct messages
        supabase
          .from("client_notifications")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("read_by_client", false)
          .or("title.eq.Mensagem da Doula,title.like.Mensagem de %"),
      ]);

      return {
        consultas: appointmentsRes.count || 0,
        servicos: servicesRes.count || 0,
        mensagens: messagesRes.count || 0,
      };
    },
    enabled: !!clientId,
    refetchInterval: 30000,
  });

  // Realtime refresh on relevant table changes
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`gestante-menu-badges-${clientId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "appointments",
        filter: `client_id=eq.${clientId}`,
      }, () => queryClient.invalidateQueries({ queryKey: ["gestante-menu-badges", clientId] }))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "service_requests",
        filter: `client_id=eq.${clientId}`,
      }, () => queryClient.invalidateQueries({ queryKey: ["gestante-menu-badges", clientId] }))
      .on("postgres_changes", {
        event: "*", schema: "public", table: "client_notifications",
        filter: `client_id=eq.${clientId}`,
      }, () => queryClient.invalidateQueries({ queryKey: ["gestante-menu-badges", clientId] }))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId, queryClient]);

  return badges;
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useGestanteUnreadCount(clientId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["gestante-unread-messages", clientId],
    queryFn: async () => {
      if (!clientId) return 0;
      const { count, error } = await supabase
        .from("client_notifications")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("read_by_client", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!clientId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`gestante-unread-badge-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_notifications", filter: `client_id=eq.${clientId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["gestante-unread-messages", clientId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, queryClient]);

  return unreadMessages;
}

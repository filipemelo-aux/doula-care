import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useAdminUnreadCounts() {
  const queryClient = useQueryClient();

  // Unread messages from clients (title starts with "Mensagem de ")
  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["admin-unread-messages-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("client_notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .like("title", "Mensagem de %");
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Unread diary entries
  const { data: unreadDiary = 0 } = useQuery({
    queryKey: ["admin-unread-diary-count"],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      const { count, error } = await supabase
        .from("pregnancy_diary")
        .select("*", { count: "exact", head: true })
        .eq("read_by_admin", false)
        .gte("created_at", twentyFourHoursAgo.toISOString());
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Pending service requests
  const { data: pendingServices = 0 } = useQuery({
    queryKey: ["admin-pending-services-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("service_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Clients in labor
  const { data: inLaborCount = 0 } = useQuery({
    queryKey: ["admin-in-labor-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("status", "gestante")
        .eq("birth_occurred", false)
        .not("labor_started_at", "is", null);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Realtime refresh
  useEffect(() => {
    const channel = supabase
      .channel("admin-badge-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-unread-messages-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pregnancy_diary" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-unread-diary-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-pending-services-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-in-labor-count"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const unreadNotifications = unreadDiary + pendingServices + inLaborCount;

  return {
    unreadMessages,
    unreadNotifications,
    totalUnread: unreadMessages + unreadNotifications,
  };
}

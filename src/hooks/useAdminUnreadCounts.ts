import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_NOTIFICATIONS_SEEN_KEY = "admin-notifications-seen";
const ADMIN_NOTIFICATIONS_SEEN_SECTION = "last_viewed";

export function useAdminUnreadCounts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Last time this user visited the Notifications page. Everything created
  // before this timestamp is considered "already seen" and won't inflate the
  // sidebar badge — it persists in the DB, so it's cross-device.
  const { data: lastSeen = null } = useQuery({
    queryKey: ["admin-notifications-last-seen", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("notification_seen")
        .select("seen_at")
        .eq("user_id", user.id)
        .eq("storage_key", ADMIN_NOTIFICATIONS_SEEN_KEY)
        .eq("section", ADMIN_NOTIFICATIONS_SEEN_SECTION)
        .maybeSingle();
      return (data?.seen_at as string | null) ?? null;
    },
    enabled: !!user?.id,
    staleTime: 10000,
  });

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

  // Unread diary entries (only newer than last visit to Notifications)
  const { data: unreadDiary = 0 } = useQuery({
    queryKey: ["admin-unread-diary-count", lastSeen],
    queryFn: async () => {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      const cutoff = lastSeen && new Date(lastSeen) > twentyFourHoursAgo
        ? lastSeen
        : twentyFourHoursAgo.toISOString();
      const { count, error } = await supabase
        .from("pregnancy_diary")
        .select("*", { count: "exact", head: true })
        .eq("read_by_admin", false)
        .gt("created_at", cutoff);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Pending service requests (only newer than last visit)
  const { data: pendingServices = 0 } = useQuery({
    queryKey: ["admin-pending-services-count", lastSeen],
    queryFn: async () => {
      let q = supabase
        .from("service_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (lastSeen) q = q.gt("created_at", lastSeen);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  // Clients in labor (only labor started after last visit)
  const { data: inLaborCount = 0 } = useQuery({
    queryKey: ["admin-in-labor-count", lastSeen],
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("status", "gestante")
        .eq("birth_occurred", false)
        .not("labor_started_at", "is", null);
      if (lastSeen) q = q.gt("labor_started_at", lastSeen);
      const { count, error } = await q;
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

/**
 * Marks all admin notifications as seen for the current user.
 * Called when the admin/moderator opens the Notifications page.
 * Persisted in DB so it works cross-device.
 */
export async function markAdminNotificationsSeen(userId: string) {
  const seenAt = new Date().toISOString();
  await supabase
    .from("notification_seen")
    .upsert(
      {
        user_id: userId,
        storage_key: ADMIN_NOTIFICATIONS_SEEN_KEY,
        section: ADMIN_NOTIFICATIONS_SEEN_SECTION,
        seen_at: seenAt,
        updated_at: seenAt,
      },
      { onConflict: "user_id,storage_key,section" },
    );
  return seenAt;
}

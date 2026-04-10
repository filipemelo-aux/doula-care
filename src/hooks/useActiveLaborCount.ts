import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchBirthAlertClients, getBirthAlertTimestamp } from "@/lib/birthAlerts";
import { useAuth } from "@/contexts/AuthContext";
import { markNotificationSeen } from "@/lib/notificationSeen";

const BIRTH_ALERT_SEEN_KEY = "birth-alert-seen";
const BIRTH_ALERT_SECTION = "last_viewed";

export function useActiveLaborCount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: alertClients = [] } = useQuery({
    queryKey: ["birth-alert-clients"],
    queryFn: fetchBirthAlertClients,
    refetchInterval: 15000,
  });

  // Fetch last seen timestamp
  const { data: lastSeenAt } = useQuery({
    queryKey: ["birth-alert-last-seen", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("notification_seen")
        .select("seen_at")
        .eq("user_id", user.id)
        .eq("storage_key", BIRTH_ALERT_SEEN_KEY)
        .eq("section", BIRTH_ALERT_SECTION)
        .maybeSingle();
      return data?.seen_at ?? null;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("labor-count-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contractions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["birth-alert-clients"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Count unseen alerts (alerts whose timestamp is newer than lastSeenAt)
  const unseenClients = alertClients.filter((client) => {
    if (!lastSeenAt) return true; // never seen = all unseen
    const alertTs = getBirthAlertTimestamp(client);
    return new Date(alertTs).getTime() > new Date(lastSeenAt).getTime();
  });

  const markAsSeen = useCallback(async () => {
    if (!user?.id) return;
    await markNotificationSeen(BIRTH_ALERT_SEEN_KEY, BIRTH_ALERT_SECTION, user.id);
    queryClient.invalidateQueries({ queryKey: ["birth-alert-last-seen"] });
  }, [user?.id, queryClient]);

  return {
    laborCount: unseenClients.filter((c) => c.is_in_labor).length,
    alertCount: unseenClients.length,
    totalAlerts: alertClients.length,
    markAsSeen,
  };
}

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Broadcasts the current admin/moderator user's presence
 * on the "doula-presence" Realtime channel.
 * Call this once in the DashboardLayout so it runs while the doula is online.
 */
export function usePresenceBroadcast() {
  const { user, organizationId, profileName, isAdmin } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || !organizationId || !isAdmin) return;

    const channel = supabase.channel("doula-presence", {
      config: { presence: { key: organizationId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        // no-op on broadcaster side
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            org_id: organizationId,
            name: profileName || "Doula",
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, organizationId, isAdmin, profileName]);
}

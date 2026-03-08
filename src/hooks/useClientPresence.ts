import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGestanteAuth } from "@/contexts/GestanteAuthContext";

/**
 * Broadcasts the current client's presence on the "client-presence" channel.
 * Call this once in GestanteLayout so it runs while the client is online.
 */
export function useClientPresenceBroadcast() {
  const { user, client, organizationId } = useGestanteAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || !client?.id || !organizationId) return;

    const channel = supabase.channel("client-presence", {
      config: { presence: { key: client.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        // no-op on broadcaster side
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            client_id: client.id,
            org_id: organizationId,
            name: client.full_name,
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
  }, [user, client?.id, organizationId]);
}

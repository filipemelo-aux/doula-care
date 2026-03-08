import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Listens to the "client-presence" channel and returns a Set of online client IDs.
 * Used in Admin messages page.
 */
export function useOnlineClients() {
  const [onlineClientIds, setOnlineClientIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel("client-presence");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set(Object.keys(state));
        setOnlineClientIds(ids);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineClientIds;
}

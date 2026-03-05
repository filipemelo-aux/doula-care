import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OnlineOrg {
  org_id: string;
  name: string;
  online_at: string;
}

/**
 * Listens to the "doula-presence" channel and returns a Set of online org IDs.
 * Used in Super Admin dashboard.
 */
export function useOnlineOrgs() {
  const [onlineOrgIds, setOnlineOrgIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel("doula-presence");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlineOrg>();
        const ids = new Set(Object.keys(state));
        setOnlineOrgIds(ids);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineOrgIds;
}

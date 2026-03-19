import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OnlineOrgInfo {
  orgId: string;
  name: string;
}

/**
 * Listens to the "doula-presence" channel and returns online org IDs + names.
 */
export function useOnlineOrgs() {
  const [onlineOrgIds, setOnlineOrgIds] = useState<Set<string>>(new Set());
  const [onlineOrgNames, setOnlineOrgNames] = useState<OnlineOrgInfo[]>([]);

  useEffect(() => {
    const channel = supabase.channel("doula-presence");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ org_id: string; name: string }>();
        const ids = new Set<string>();
        const names: OnlineOrgInfo[] = [];

        for (const [key, presences] of Object.entries(state)) {
          ids.add(key);
          const first = presences[0];
          if (first) {
            names.push({ orgId: key, name: first.name || "Doula" });
          }
        }

        setOnlineOrgIds(ids);
        setOnlineOrgNames(names);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { onlineOrgIds, onlineOrgNames };
}

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hardRefreshApp } from "@/lib/appUpdate";

const LAST_FORCE_UPDATE_KEY = "last_force_update_at";

function clearCacheAndReload() {
  void hardRefreshApp();
}

function checkAndApply(forceUpdateAt: string) {
  const lastSeen = localStorage.getItem(LAST_FORCE_UPDATE_KEY) || "2000-01-01T00:00:00Z";
  if (forceUpdateAt > lastSeen) {
    localStorage.setItem(LAST_FORCE_UPDATE_KEY, forceUpdateAt);
    console.log("[ForceUpdate] Forced update triggered:", forceUpdateAt);
    clearCacheAndReload();
  }
}

export function ForceUpdateListener() {
  useEffect(() => {
    // Check on mount
    supabase
      .from("system_config" as any)
      .select("value")
      .eq("key", "force_update_at")
      .single()
      .then(({ data }) => {
        if (data) checkAndApply((data as any).value);
      });

    // Listen for realtime changes
    const channel = supabase
      .channel("force-update")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "system_config", filter: "key=eq.force_update_at" },
        (payload) => {
          const newValue = (payload.new as any)?.value;
          if (newValue) checkAndApply(newValue);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}

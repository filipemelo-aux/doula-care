import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useActiveLaborCount() {
  const queryClient = useQueryClient();

  const { data: laborCount = 0 } = useQuery({
    queryKey: ["active-labor-count"],
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
    refetchInterval: 15000,
  });

  const { data: alertCount = 0 } = useQuery({
    queryKey: ["birth-alert-total-count"],
    queryFn: async () => {
      // Count gestantes with 37+ weeks OR in labor
      const { data, error } = await supabase
        .from("clients")
        .select("id, pregnancy_weeks, pregnancy_weeks_set_at, dpp, labor_started_at")
        .eq("status", "gestante")
        .eq("birth_occurred", false);
      if (error) throw error;

      // Import dynamically to avoid circular deps
      const { calculateCurrentPregnancyWeeks } = await import("@/lib/pregnancy");
      
      return data.filter(c => {
        if (c.labor_started_at) return true;
        const weeks = calculateCurrentPregnancyWeeks(c.pregnancy_weeks, c.pregnancy_weeks_set_at, c.dpp);
        return weeks !== null && weeks >= 37;
      }).length;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("labor-count-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        queryClient.invalidateQueries({ queryKey: ["active-labor-count"] });
        queryClient.invalidateQueries({ queryKey: ["birth-alert-total-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "contractions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["active-labor-count"] });
        queryClient.invalidateQueries({ queryKey: ["birth-alert-total-count"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return { laborCount, alertCount };
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchBirthAlertClients } from "@/lib/birthAlerts";

export function useActiveLaborCount() {
  const queryClient = useQueryClient();

  const { data: alertClients = [] } = useQuery({
    queryKey: ["birth-alert-clients"],
    queryFn: fetchBirthAlertClients,
    refetchInterval: 15000,
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

  return {
    laborCount: alertClients.filter((client) => client.is_in_labor).length,
    alertCount: alertClients.length,
  };
}

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lê a configuração global "hide_free_plan" definida pelo Super Admin
 * e mantém o valor sincronizado em tempo real em toda a aplicação.
 */
export function useHideFreePlan() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["system-config-hide-free-plan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "hide_free_plan")
        .maybeSingle();
      return (data as any)?.value === "true";
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel("system-config-hide-free-plan")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_config" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["system-config-hide-free-plan"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return !!data;
}

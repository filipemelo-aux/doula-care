import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches plan_settings and returns a lookup function
 * that resolves a client's plan name from plan_setting_id,
 * falling back to "Avulso" for avulso clients or the raw plan enum.
 */
export function usePlanNames() {
  const { data: planSettings } = useQuery({
    queryKey: ["plan-settings-names"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_settings")
        .select("id, name, plan_type");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const planMap = new Map<string, string>();
  planSettings?.forEach((p) => {
    planMap.set(p.id, p.name);
  });

  /**
   * Get the display name for a client's plan.
   * @param planSettingId - client.plan_setting_id
   * @param planEnum - client.plan (fallback)
   */
  const getPlanName = (planSettingId: string | null, planEnum: string): string => {
    if (planSettingId && planMap.has(planSettingId)) {
      return planMap.get(planSettingId)!;
    }
    if (planEnum === "avulso") return "Avulso";
    // Fallback: capitalize enum
    return planEnum.charAt(0).toUpperCase() + planEnum.slice(1);
  };

  return { getPlanName, planSettings };
}

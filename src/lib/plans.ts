import { supabase } from "@/integrations/supabase/client";

export interface PlanInfo {
  id: string;
  name: string;
  price_monthly: number; // centavos
  price_yearly: number;  // centavos
  is_free: boolean;
}

/**
 * Fetches a plan by its ID using the database function get_plan_by_id.
 */
export async function getPlanById(planId: string): Promise<PlanInfo | null> {
  const { data, error } = await supabase.rpc("get_plan_by_id", {
    p_plan_id: planId,
  } as any);

  if (error || !data || (data as any[]).length === 0) return null;

  const row = (data as any[])[0];
  return {
    id: row.id,
    name: row.name,
    price_monthly: Number(row.price_monthly),
    price_yearly: Number(row.price_yearly),
    is_free: row.is_free,
  };
}

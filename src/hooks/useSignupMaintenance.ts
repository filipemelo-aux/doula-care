import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SignupMaintenance {
  active: boolean;
  until: Date | null;
  hoursLeft: number | null;
}

/**
 * Lê as chaves `signup_maintenance` / `signup_maintenance_until` para saber se
 * a criação de novas contas de doula está temporariamente bloqueada.
 */
export function useSignupMaintenance() {
  return useQuery<SignupMaintenance>({
    queryKey: ["signup-maintenance"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("system_config")
        .select("key, value")
        .in("key", ["signup_maintenance", "signup_maintenance_until"]);

      const map = new Map((data || []).map((r: any) => [r.key, String(r.value ?? "")]));
      const flag = (map.get("signup_maintenance") || "").toLowerCase();
      const rawUntil = map.get("signup_maintenance_until") || "";
      const untilTs = rawUntil ? Date.parse(rawUntil) : NaN;
      const until = Number.isNaN(untilTs) ? null : new Date(untilTs);

      const enabled = flag === "on" || flag === "true" || flag === "1";
      const expired = until ? until.getTime() <= Date.now() : false;
      const active = enabled && !expired;
      const hoursLeft = active && until
        ? Math.max(1, Math.ceil((until.getTime() - Date.now()) / 3_600_000))
        : null;

      return { active, until, hoursLeft };
    },
  });
}

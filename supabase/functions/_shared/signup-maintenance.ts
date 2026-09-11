// Verifica se a criação de novas contas está temporariamente bloqueada.
// Controlado pelas chaves `signup_maintenance` e `signup_maintenance_until` em system_config.
export async function getSignupMaintenance(admin: any): Promise<{ active: boolean; until: string | null }> {
  try {
    const { data } = await admin
      .from("system_config")
      .select("key, value")
      .in("key", ["signup_maintenance", "signup_maintenance_until"]);

    const map = new Map((data || []).map((r: any) => [r.key, String(r.value ?? "")]));
    const flag = (map.get("signup_maintenance") || "").toLowerCase();
    const until = map.get("signup_maintenance_until") || null;

    if (flag !== "on" && flag !== "true" && flag !== "1") return { active: false, until: null };
    if (until) {
      const ts = Date.parse(until);
      if (!Number.isNaN(ts) && ts <= Date.now()) return { active: false, until };
    }
    return { active: true, until };
  } catch {
    return { active: false, until: null };
  }
}

export const MAINTENANCE_MESSAGE =
  "Estamos em manutenção e novos cadastros estão temporariamente indisponíveis. Tente novamente em algumas horas.";

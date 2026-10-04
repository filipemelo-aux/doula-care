import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { expandFeatures } from "@/lib/planFeatures";

// Fonte única do plano da cliente: clients.plan_setting_id -> plan_settings (configurado pela doula).
// A coluna legada clients.plan NUNCA é exibida; sem plano vinculado = "Avulso".

export type ClientConsultationState = "available" | "requested" | "scheduled" | "done";

export interface ClientConsultation {
  sequence: number;
  name: string;
  state: ClientConsultationState;
  scheduledAt?: string | null;
  requestedFor?: string | null;
}

export function useClientPlan(clientId?: string | null) {
  return useQuery({
    queryKey: ["client-plan-consultations", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data: c } = await supabase
        .from("clients")
        .select("plan_setting_id, plan_value")
        .eq("id", clientId!)
        .maybeSingle();

      let planName = "Avulso";
      let features: string[] = [];
      if (c?.plan_setting_id) {
        const { data: p } = await supabase
          .from("plan_settings")
          .select("name, features")
          .eq("id", c.plan_setting_id)
          .maybeSingle();
        if (p?.name) planName = p.name.trim();
        features = expandFeatures(p?.features as string[] | null);
      }

      const [{ data: sess }, { data: reqs }] = await Promise.all([
        (supabase.from("followup_sessions" as any) as any)
          .select("sequence, service_name, status, appointments(scheduled_at)")
          .eq("client_id", clientId),
        supabase
          .from("appointment_requests")
          .select("consultation_sequence, requested_date, requested_time, status")
          .eq("client_id", clientId!)
          .eq("status", "pending")
          .not("consultation_sequence", "is", null),
      ]);
      const sessions = (sess || []) as { sequence: number | null; service_name: string; status: string; appointments?: { scheduled_at: string } | null }[];

      const consultations: ClientConsultation[] = features.map((name, i) => {
        const sequence = i + 1;
        const s = sessions.find((x) => x.sequence === sequence) || sessions.find((x) => x.sequence == null && x.service_name === name);
        if (s?.status === "done") return { sequence, name, state: "done" };
        if (s?.status === "scheduled") return { sequence, name, state: "scheduled", scheduledAt: s.appointments?.scheduled_at ?? null };
        const r = (reqs || []).find((x: any) => x.consultation_sequence === sequence);
        if (r) return { sequence, name, state: "requested", requestedFor: `${r.requested_date}T${String(r.requested_time).slice(0, 5)}` };
        return { sequence, name, state: "available" };
      });

      return { planName, planValue: c?.plan_value ?? null, hasPlan: !!c?.plan_setting_id, consultations };
    },
  });
}

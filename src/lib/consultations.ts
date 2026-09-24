import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanConsultation {
  id: string;
  plan_setting_id: string;
  name: string;
  quantity: number;
  modality: string;
  sort_order: number;
}

export interface FollowupSession {
  id: string;
  client_id: string;
  service_name: string;
  sequence: number | null;
  status: "scheduled" | "done";
  performed_at: string | null;
  notes: string | null;
  appointment_id: string | null;
  appointments?: { scheduled_at: string; completed_at: string | null } | null;
}

export interface ConsultationStep {
  sequence: number;
  label: string;
  modality: string;
  session?: FollowupSession;
  state: "pending" | "scheduled" | "done";
}

const db = (t: string) => supabase.from(t as any) as any;

export function usePlanConsultations(organizationId?: string | null) {
  return useQuery({
    queryKey: ["plan-consultations", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db("plan_consultations")
        .select("id, plan_setting_id, name, quantity, modality, sort_order")
        .eq("organization_id", organizationId)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as PlanConsultation[];
    },
  });
}

export function useFollowupSessions(organizationId?: string | null, clientId?: string) {
  return useQuery({
    queryKey: ["followup-sessions", organizationId, clientId || "all"],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = db("followup_sessions")
        .select("id, client_id, service_name, sequence, status, performed_at, notes, appointment_id, appointments(scheduled_at, completed_at)")
        .eq("organization_id", organizationId);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as FollowupSession[];
    },
  });
}

export function buildSteps(planSettingId: string | null | undefined, items: PlanConsultation[], sessions: FollowupSession[]): ConsultationStep[] {
  if (!planSettingId) return [];
  const planItems = items.filter((i) => i.plan_setting_id === planSettingId).sort((a, b) => a.sort_order - b.sort_order);
  const steps: ConsultationStep[] = [];
  let seq = 0;
  planItems.forEach((item) => {
    for (let n = 1; n <= Math.max(1, item.quantity); n++) {
      seq++;
      const label = item.quantity > 1 ? `${item.name} ${n}/${item.quantity}` : item.name;
      const session = sessions.find((s) => s.sequence === seq) || sessions.find((s) => s.sequence == null && (s.service_name === label || s.service_name === item.name));
      steps.push({ sequence: seq, label, modality: item.modality, session, state: session ? session.status : "pending" });
    }
  });
  return steps;
}

export const sessionsDb = () => db("followup_sessions");
export const planConsultationsDb = () => db("plan_consultations");

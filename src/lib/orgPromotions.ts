import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/lib/pushNotifications";

export class TrialNotAllowedError extends Error {}

/** True se a org tem assinatura Pro/Premium ativa ou acesso vitalício. */
export async function hasPaidOrLifetimePlan(orgId: string): Promise<boolean> {
  const { data: life } = await supabase
    .from("org_promotions" as any)
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "lifetime_active")
    .limit(1);
  if (life && life.length) return true;
  const { data: profiles } = await supabase.from("profiles").select("user_id").eq("organization_id", orgId);
  const ids = (profiles || []).map((p) => p.user_id);
  if (!ids.length) return false;
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id")
    .in("user_id", ids)
    .eq("status", "active")
    .limit(1);
  return !!(subs && subs.length);
}

/** Encerra o trial agora: plano volta para Free e a mensagem de assinatura aparece. */
export async function endOrgTrial(orgId: string): Promise<boolean> {
  const { data: trials } = await supabase
    .from("org_promotions" as any)
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "trial_active");
  if (!trials || !trials.length) return false;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("org_promotions" as any)
    .update({ status: "expired", trial_ends_at: now } as any)
    .eq("organization_id", orgId)
    .eq("status", "trial_active");
  if (error) throw error;
  if (!(await hasPaidOrLifetimePlan(orgId))) {
    await supabase.from("organizations").update({ plan: "free" as any }).eq("id", orgId);
    await notifyTrialEnded(orgId);
  }
  return true;
}

/** Lança trial Premium de 15 dias; ao fim, sem assinatura, o cron volta a org para Free. */
export async function startOrgTrial(orgId: string) {
  if (await hasPaidOrLifetimePlan(orgId)) throw new TrialNotAllowedError("plano ativo");
  const now = new Date();
  const ends = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const { error } = await supabase.from("org_promotions" as any).upsert(
    {
      organization_id: orgId,
      promotion_type: "trial_15d",
      status: "trial_active",
      trial_started_at: now.toISOString(),
      trial_ends_at: ends.toISOString(),
      chosen_plan: null,
    } as any,
    { onConflict: "organization_id,promotion_type" }
  );
  if (error) throw error;
  const { error: orgErr } = await supabase.from("organizations").update({ plan: "premium" as any }).eq("id", orgId);
  if (orgErr) throw orgErr;
  await supabase.from("org_notifications").insert({
    organization_id: orgId,
    title: "🎁 15 dias de teste Premium liberados!",
    message: "Aproveite todos os recursos do Doula Care, incluindo equipe, por 15 dias.",
    type: "promotion",
  });
}

/** Torna a organização Premium vitalícia. */
export async function makeOrgLifetime(orgId: string) {
  const { data: existing } = await supabase
    .from("org_promotions" as any)
    .select("id")
    .eq("organization_id", orgId)
    .eq("promotion_type", "lifetime_premium")
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from("org_promotions" as any)
      .update({ status: "lifetime_active", trial_ends_at: null } as any)
      .eq("id", (existing as any).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("org_promotions" as any)
      .insert({ organization_id: orgId, promotion_type: "lifetime_premium", status: "lifetime_active", trial_ends_at: null } as any);
    if (error) throw error;
  }
  // Encerra trials ativos para não haver downgrade posterior
  await supabase
    .from("org_promotions" as any)
    .update({ status: "completed" } as any)
    .eq("organization_id", orgId)
    .eq("status", "trial_active");
  const { error: orgErr } = await supabase.from("organizations").update({ plan: "premium" as any }).eq("id", orgId);
  if (orgErr) throw orgErr;
  await supabase.from("org_notifications").insert({
    organization_id: orgId,
    title: "👑 Acesso Premium Vitalício!",
    message: "Acesso Premium vitalício concedido para esta organização.",
    type: "promotion",
  });
}

/** Avisa a doula que o teste acabou: notificação no painel + push. */
export async function notifyTrialEnded(orgId: string) {
  await supabase.from("org_notifications").insert({
    organization_id: orgId,
    title: "💛 Seu teste chegou ao fim",
    message:
      "Foi uma alegria ter você com a gente! Escolha seu plano para continuar com todos os recursos — se trabalha com equipe, o Premium é o ideal. Até lá, sua conta segue no plano Free.",
    type: "billing",
  });
  const { data: profiles } = await supabase.from("profiles").select("user_id").eq("organization_id", orgId);
  const ids = (profiles || []).map((p) => p.user_id);
  if (ids.length) {
    await sendPushNotification({
      user_ids: ids,
      title: "💛 Seu teste chegou ao fim",
      message: "Escolha seu plano para continuar com todos os recursos do Doula Care.",
      url: "/admin/assinatura",
    });
  }
}

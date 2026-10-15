import { supabase } from "@/integrations/supabase/client";

/** Lança trial Premium de 15 dias; ao fim, sem assinatura, o cron volta a org para Free. */
export async function startOrgTrial(orgId: string) {
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
    title: "🎁 15 dias de Premium liberados!",
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

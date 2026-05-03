// Shared helpers for IAP validation edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

export async function getAuthedUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data } = await anon.auth.getUser();
  return data?.user ?? null;
}

export interface PlanProductRow {
  plan_id: string;
  plan_slug: string;
  billing_period: "monthly" | "yearly";
}

/** Resolve product_id da loja para plano interno + período. */
export async function resolvePlanByProduct(
  supabase: ReturnType<typeof getServiceClient>,
  platform: "ios" | "android",
  productId: string
): Promise<PlanProductRow | null> {
  const { data, error } = await supabase
    .from("plan_store_products")
    .select("plan_id, billing_period, plan:platform_plan_limits!inner(plan)")
    .eq("platform", platform)
    .eq("product_id", productId)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  return {
    plan_id: data.plan_id as string,
    billing_period: data.billing_period as "monthly" | "yearly",
    plan_slug: (data as any).plan?.plan ?? "free",
  };
}

/** Cria/atualiza subscription ativa e propaga plano para a organização. */
export async function activateSubscription(
  supabase: ReturnType<typeof getServiceClient>,
  params: {
    user_id: string;
    plan_id: string;
    plan_slug: string;
    platform: "ios" | "android";
    product_id: string;
    billing_period: "monthly" | "yearly";
    store_subscription_id?: string | null;
    original_transaction_id?: string | null;
    purchase_token?: string | null;
    period_end?: Date | null;
    raw_payload?: any;
  }
) {
  const now = new Date();
  const periodEnd =
    params.period_end ??
    new Date(
      now.getTime() +
        (params.billing_period === "yearly"
          ? 365 * 24 * 60 * 60 * 1000
          : 31 * 24 * 60 * 60 * 1000)
    );

  // Cancel any other active sub for this user
  await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: now.toISOString() })
    .eq("user_id", params.user_id)
    .eq("status", "active");

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: params.user_id,
      plan_id: params.plan_id,
      status: "active",
      platform: params.platform,
      product_id: params.product_id,
      store_subscription_id: params.store_subscription_id ?? null,
      original_transaction_id: params.original_transaction_id ?? null,
      purchase_token: params.purchase_token ?? null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;

  // Propagate plan to organization
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", params.user_id)
    .maybeSingle();

  if (profile?.organization_id) {
    await supabase
      .from("organizations")
      .update({ plan: params.plan_slug, updated_at: now.toISOString() })
      .eq("id", profile.organization_id);
  }

  await supabase.from("subscription_events").insert({
    user_id: params.user_id,
    subscription_id: sub.id,
    platform: params.platform,
    event_type: "purchase_validated",
    product_id: params.product_id,
    raw_payload: params.raw_payload ?? null,
  });

  return sub.id as string;
}

/** Rebaixa para Free na organização e marca subscription como expirada/cancelada. */
export async function downgradeToFree(
  supabase: ReturnType<typeof getServiceClient>,
  user_id: string,
  reason: "expired" | "canceled" | "billing_issue"
) {
  await supabase
    .from("subscriptions")
    .update({
      status: reason === "billing_issue" ? "billing_issue" : reason,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user_id)
    .in("status", ["active", "grace_period", "pending"]);

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user_id)
    .maybeSingle();
  if (profile?.organization_id) {
    await supabase
      .from("organizations")
      .update({ plan: "free", updated_at: new Date().toISOString() })
      .eq("id", profile.organization_id);
  }

  await supabase.from("subscription_events").insert({
    user_id,
    platform: "manual",
    event_type: `downgraded_${reason}`,
  });
}

// Validate Android In-App Purchase (Google Play Billing) — thin server-side activation.
// NOTE: Full Google Play Developer API verification requires
// GOOGLE_PLAY_SERVICE_ACCOUNT credentials. Today this function trusts the
// payload after matching it to a known plan_store_products row. A TODO hook
// is left to plug strict purchases.subscriptionsv2.get verification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing auth" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userRes } = await anon.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const product_id = String(body.product_id || "").trim();
    const purchase_token = body.purchase_token ? String(body.purchase_token) : null;
    const order_id = body.order_id ? String(body.order_id) : null;

    if (!product_id || !purchase_token) {
      return json({ error: "product_id and purchase_token are required" }, 400);
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // TODO(prod): verify with Google Play Developer API
    // (purchases.subscriptionsv2.get). Requires
    // GOOGLE_PLAY_SERVICE_ACCOUNT_JSON secret + acknowledge() call.

    const { data: mapping, error: mapErr } = await svc
      .from("plan_store_products")
      .select("plan_id, billing_period, plan:platform_plan_limits!inner(plan)")
      .eq("platform", "android")
      .eq("product_id", product_id)
      .eq("active", true)
      .maybeSingle();
    if (mapErr || !mapping) return json({ error: "Unknown product_id" }, 404);

    const plan_slug = (mapping as any).plan?.plan ?? "free";
    const billing_period = (mapping as any).billing_period as "monthly" | "yearly";

    const now = new Date();
    const periodEnd = new Date(
      now.getTime() +
        (billing_period === "yearly"
          ? 365 * 24 * 60 * 60 * 1000
          : 31 * 24 * 60 * 60 * 1000)
    );

    await svc
      .from("subscriptions")
      .update({ status: "canceled", updated_at: now.toISOString() })
      .eq("user_id", user.id)
      .eq("status", "active");

    const { data: sub, error: insErr } = await svc
      .from("subscriptions")
      .insert({
        user_id: user.id,
        plan_id: mapping.plan_id,
        status: "active",
        platform: "android",
        product_id,
        purchase_token,
        store_subscription_id: order_id,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const { data: profile } = await svc
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.organization_id) {
      await svc
        .from("organizations")
        .update({ plan: plan_slug, updated_at: now.toISOString() })
        .eq("id", profile.organization_id);
    }

    await svc.from("subscription_events").insert({
      user_id: user.id,
      subscription_id: sub.id,
      platform: "android",
      event_type: "purchase_validated",
      product_id,
      raw_payload: { purchase_token, order_id },
    });

    return json({ success: true, plan: plan_slug, period_end: periodEnd.toISOString() });
  } catch (err: any) {
    console.error("[validate-android-purchase]", err);
    return json({ error: err?.message || "Internal error" }, 500);
  }

  function json(body: any, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

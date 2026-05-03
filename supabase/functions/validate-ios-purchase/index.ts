// Validate iOS In-App Purchase (StoreKit) — thin server-side activation.
// NOTE: Full Apple App Store Server API receipt validation requires
// APP_STORE_CONNECT_KEY_ID/ISSUER/PRIVATE_KEY secrets. This function performs
// trust-on-payload activation today and exposes a TODO hook to plug strict
// JWS verification once those credentials are configured.
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
    const transaction_id = body.transaction_id ? String(body.transaction_id) : null;
    const original_transaction_id = body.original_transaction_id
      ? String(body.original_transaction_id)
      : null;
    const receipt = body.receipt ?? null;

    if (!product_id || !transaction_id) {
      return json({ error: "product_id and transaction_id are required" }, 400);
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // TODO(prod): verify JWS receipt with Apple App Store Server API.
    // Requires APPSTORE_KEY_ID, APPSTORE_ISSUER_ID, APPSTORE_PRIVATE_KEY,
    // APPSTORE_BUNDLE_ID secrets. For now we trust the payload only when a
    // matching plan_store_products row exists.

    const { data: mapping, error: mapErr } = await svc
      .from("plan_store_products")
      .select("plan_id, billing_period, plan:platform_plan_limits!inner(plan)")
      .eq("platform", "ios")
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
        platform: "ios",
        product_id,
        store_subscription_id: transaction_id,
        original_transaction_id,
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
      platform: "ios",
      event_type: "purchase_validated",
      product_id,
      raw_payload: { transaction_id, original_transaction_id, has_receipt: !!receipt },
    });

    return json({ success: true, plan: plan_slug, period_end: periodEnd.toISOString() });
  } catch (err: any) {
    console.error("[validate-ios-purchase]", err);
    return json({ error: err?.message || "Internal error" }, 500);
  }

  function json(body: any, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

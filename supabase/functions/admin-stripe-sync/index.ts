import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { findPlanByPriceId } from "../_shared/stripe-plans.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-setup-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = Deno.env.get("STRIPE_WEBHOOK_TOKEN");
  if (!token || req.headers.get("x-setup-token") !== token) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_LIVE_API_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY")!;
  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const url = new URL(req.url);
  if (url.searchParams.get("action") === "webhooks") {
    const eps = await stripe.webhookEndpoints.list({ limit: 10 });
    const events = await stripe.events.list({ limit: 10 });
    return new Response(JSON.stringify({
      endpoints: eps.data.map((e) => ({ id: e.id, url: e.url, status: e.status, enabled_events: e.enabled_events })),
      recent_events: events.data.map((e) => ({ id: e.id, type: e.type, created: e.created, pending_webhooks: e.pending_webhooks })),
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const out: unknown[] = [];
  const subs = await stripe.subscriptions.list({ limit: 20, status: "all" });

  for (const sub of subs.data) {
    const priceId = sub.items.data[0]?.price?.id;
    const planInfo = findPlanByPriceId(priceId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    const email = (customer as Stripe.Customer)?.email ?? null;

    let userId = (sub.metadata?.user_id as string | undefined) ?? null;
    if (!userId && email) {
      const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = data?.users?.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase())?.id ?? null;
    }

    const entry: Record<string, unknown> = {
      id: sub.id, status: sub.status, priceId, email, userId, plan: planInfo?.plan ?? null,
    };

    if (planInfo && userId) {
      const active = ["active", "trialing", "past_due"].includes(sub.status);
      const status = sub.status === "past_due" ? "billing_issue" : active ? "active" : "canceled";
      const payload = {
        user_id: userId,
        plan_id: planInfo.planId,
        status,
        platform: "web",
        product_id: priceId,
        current_period_start: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
      };
      const { data: existing } = await supabase
        .from("subscriptions").select("id").eq("stripe_subscription_id", sub.id).maybeSingle();
      if (existing?.id) {
        await supabase.from("subscriptions").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("subscriptions").update({ status: "canceled" })
          .eq("user_id", userId).eq("platform", "web").in("status", ["active", "pending", "billing_issue"]);
        await supabase.from("subscriptions").insert(payload);
      }
      const { data: profile } = await supabase
        .from("profiles").select("organization_id").eq("user_id", userId).maybeSingle();
      if (profile?.organization_id && status !== "canceled") {
        await supabase.from("organizations").update({
          plan: planInfo.plan, status: "ativo",
          next_billing_date: payload.current_period_end ? String(payload.current_period_end).split("T")[0] : null,
        }).eq("id", profile.organization_id);
      }
      entry.synced = true;
    }
    out.push(entry);
  }

  return new Response(JSON.stringify({ count: subs.data.length, subscriptions: out }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

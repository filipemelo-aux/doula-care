import { persistStripeSubscription } from '../_shared/stripeSync.ts';
import { reconcilePlan } from '../_shared/subscriptionServer.ts';
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
      await persistStripeSubscription(sub, userId);
      await reconcilePlan(userId);
      entry.synced = true;
    }
    out.push(entry);
  }

  return new Response(JSON.stringify({ count: subs.data.length, subscriptions: out }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

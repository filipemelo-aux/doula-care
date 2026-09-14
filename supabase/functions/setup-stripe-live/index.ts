// Função temporária de setup: cria os 4 preços em modo live e o endpoint
// de webhook ao vivo. Protegida por x-setup-token = STRIPE_WEBHOOK_TOKEN.
// REMOVER após o uso.
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-setup-token",
};

const PLANS = [
  { product: "Doula Care Pro", plan: "pro", billing: "monthly", amount: 4490, interval: "month" },
  { product: "Doula Care Pro", plan: "pro", billing: "yearly", amount: 44990, interval: "year" },
  { product: "Doula Care Premium", plan: "premium", billing: "monthly", amount: 6490, interval: "month" },
  { product: "Doula Care Premium", plan: "premium", billing: "yearly", amount: 64990, interval: "year" },
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = Deno.env.get("STRIPE_WEBHOOK_TOKEN");
  if (!token || req.headers.get("x-setup-token") !== token) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_LIVE_API_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Stripe key not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const result: Record<string, unknown> = { prices: {}, webhook: null };

  // 1) Produtos + preços (idempotente por metadata)
  for (const p of PLANS) {
    let products = await stripe.products.list({ active: true, limit: 100 });
    let product = products.data.find(
      (pr) => pr.name === p.product && pr.metadata?.app === "doula_care"
    );
    if (!product) {
      product = await stripe.products.create({
        name: p.product,
        metadata: { app: "doula_care" },
      });
    }

    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    let price = prices.data.find(
      (pr) =>
        pr.recurring?.interval === p.interval &&
        pr.unit_amount === p.amount &&
        pr.currency === "brl"
    );
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        currency: "brl",
        unit_amount: p.amount,
        recurring: { interval: p.interval },
        metadata: { app: "doula_care", plan: p.plan, billing: p.billing },
      });
    }
    (result.prices as Record<string, string>)[`${p.plan}_${p.billing}`] = price.id;
  }

  // 2) Webhook endpoint (live) — idempotente por URL
  const baseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const webhookUrl = `${baseUrl}/functions/v1/stripe-webhook?t=${token}`;
  const events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
  ];

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const found = existing.data.find((w) => w.url === webhookUrl && w.status === "enabled");
  if (found) {
    result.webhook = { id: found.id, status: "existing" };
  } else {
    const created = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: events,
      description: "Doula Care — assinaturas web",
    });
    result.webhook = { id: created.id, status: "created" };
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

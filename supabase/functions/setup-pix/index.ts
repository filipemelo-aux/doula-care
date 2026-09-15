import Stripe from "https://esm.sh/stripe@18.5.0";

const PLANS = [
  { key: "pro_monthly", product: "Doula Care Pro", nickname: "Pro mensal (Pix)", amount: 4490 },
  { key: "pro_yearly", product: "Doula Care Pro", nickname: "Pro anual (Pix)", amount: 44990 },
  { key: "premium_monthly", product: "Doula Care Premium", nickname: "Premium mensal (Pix)", amount: 6490 },
  { key: "premium_yearly", product: "Doula Care Premium", nickname: "Premium anual (Pix)", amount: 64990 },
];

Deno.serve(async (req) => {
  const token = req.headers.get("x-setup-token");
  if (!token || token !== Deno.env.get("STRIPE_WEBHOOK_TOKEN")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const key = Deno.env.get("STRIPE_LIVE_API_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY")!;
  const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });

  const result: Record<string, unknown> = {};

  // localizar/criar produtos
  const products = await stripe.products.list({ limit: 100, active: true });
  const productId = async (name: string) => {
    const found = products.data.find((p) => p.name === name);
    if (found) return found.id;
    const created = await stripe.products.create({ name, metadata: { app: "doula_care" } });
    return created.id;
  };

  for (const plan of PLANS) {
    const prodId = await productId(plan.product);
    const existing = await stripe.prices.list({ product: prodId, limit: 100, active: true });
    const match = existing.data.find(
      (p) => !p.recurring && p.unit_amount === plan.amount && p.currency === "brl" &&
        p.metadata?.app === "doula_care" && p.metadata?.pix_key === plan.key
    );
    if (match) {
      result[plan.key] = match.id;
      continue;
    }
    const price = await stripe.prices.create({
      product: prodId,
      currency: "brl",
      unit_amount: plan.amount,
      nickname: plan.nickname,
      metadata: { app: "doula_care", pix_key: plan.key },
    });
    result[plan.key] = price.id;
  }

  // garantir eventos assíncronos do Pix no webhook
  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
  const ep = endpoints.data.find((e) => e.url.includes("stripe-webhook"));
  if (ep) {
    const events = new Set<string>([
      ...ep.enabled_events,
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ]);
    await stripe.webhookEndpoints.update(ep.id, { enabled_events: [...events] as any });
    result.webhook = { id: ep.id, events: [...events] };
  }

  // status do método Pix na conta
  try {
    const account = await stripe.accounts.retrieve();
    result.pix_capability = (account.capabilities as Record<string, string>)?.pix_payments ?? "unknown";
  } catch (_e) {
    result.pix_capability = "unreadable";
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});

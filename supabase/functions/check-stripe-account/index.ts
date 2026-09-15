import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

serve(async (req) => {
  if (req.headers.get("x-setup-token") !== Deno.env.get("STRIPE_WEBHOOK_TOKEN")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const stripe = new Stripe(Deno.env.get("STRIPE_LIVE_API_KEY") || "", { apiVersion: "2025-08-27.basil" });
  const acct = await stripe.accounts.retrieve();
  const balances = await stripe.balance.retrieve().catch(() => null);
  return new Response(JSON.stringify({
    id: acct.id,
    business_name: acct.business_profile?.name,
    charges_enabled: acct.charges_enabled,
    payouts_enabled: acct.payouts_enabled,
    details_submitted: acct.details_submitted,
    statement_descriptor: acct.settings?.payments?.statement_descriptor,
    currently_due: acct.requirements?.currently_due,
    eventually_due: acct.requirements?.eventually_due,
    past_due: acct.requirements?.past_due,
    pending_verification: acct.requirements?.pending_verification,
    disabled_reason: acct.requirements?.disabled_reason,
    capabilities: acct.capabilities,
    balance: balances ? balances.available : null,
  }), { headers: { "Content-Type": "application/json" } });
});

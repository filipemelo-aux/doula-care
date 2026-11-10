import Stripe from 'https://esm.sh/stripe@18.5.0';
import { findPlanByPriceId } from './stripe-plans.ts';
import { serviceClient, reconcilePlan } from './subscriptionServer.ts';

export function stripeClient() {
  const key = Deno.env.get('STRIPE_LIVE_API_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe não configurado');
  return new Stripe(key, { apiVersion: '2025-08-27.basil' });
}

export async function persistStripeSubscription(sub: any, userId: string) {
  const svc = serviceClient();
  const priceId = sub.items.data[0]?.price?.id;
  const { data: existing, error: readError } = await svc.from('subscriptions').select('id,plan_id').eq('stripe_subscription_id', sub.id).maybeSingle();
  if (readError) throw readError;
  const mapped = findPlanByPriceId(priceId);
  const planId = mapped?.planId ?? existing?.plan_id;
  if (!planId) throw new Error('Plano do Stripe não identificado');
  const item = sub.items.data[0];
  const start = sub.current_period_start ?? item?.current_period_start;
  const end = sub.current_period_end ?? item?.current_period_end;
  const status = ['active', 'trialing'].includes(sub.status) ? 'active' : sub.status === 'past_due' ? 'billing_issue' : sub.status === 'incomplete' ? 'pending' : 'canceled';
  const record = {
    user_id: userId, plan_id: planId, platform: 'web', environment: sub.livemode ? 'production' : 'sandbox', status,
    stripe_subscription_id: sub.id, stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    product_id: priceId, auto_renew: !sub.cancel_at_period_end,
    current_period_start: start ? new Date(start * 1000).toISOString() : null,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing ? await svc.from('subscriptions').update(record).eq('id', existing.id) : await svc.from('subscriptions').insert(record);
  if (error) throw error;
  return record;
}

export async function syncStripeUser(userId: string, email?: string) {
  const svc = serviceClient();
  const stripe = stripeClient();
  const { data: rows, error } = await svc.from('subscriptions').select('stripe_subscription_id').eq('user_id', userId).not('stripe_subscription_id', 'is', null);
  if (error) throw error;
  const ids = new Set<string>((rows ?? []).map(r => r.stripe_subscription_id).filter(Boolean));
  // Also recover checkout payments whose webhook has not arrived yet.
  if (email) {
    for await (const customer of stripe.customers.list({ email, limit: 100 })) {
      for await (const sub of stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })) ids.add(sub.id);
    }
  }
  for (const id of ids) {
    const sub = await stripe.subscriptions.retrieve(id);
    await persistStripeSubscription(sub, userId);
  }
  return reconcilePlan(userId);
}
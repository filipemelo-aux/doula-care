import { serviceClient, reconcilePlan } from './subscriptionServer.ts';
import { storeStatus } from './subscriptionRules.ts';

export async function syncStoreUser(userId: string, platform?: 'ios' | 'android', productId?: string) {
  const key = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!key) throw new Error('A confirmação de pagamentos das lojas ainda não está configurada.');
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Não foi possível confirmar a assinatura com RevenueCat (${response.status}).`);
  const { subscriber } = await response.json();
  const svc = serviceClient();
  let matched = false;
  for (const [product, value] of Object.entries(subscriber?.subscriptions ?? {})) {
    const purchase = value as any;
    const store = purchase.store === 'app_store' ? 'ios' : purchase.store === 'play_store' ? 'android' : null;
    if (!store || (platform && store !== platform) || (productId && product.split(':')[0] !== productId)) continue;
    const { data: mapping, error: mapError } = await svc.from('plan_store_products').select('plan_id').eq('platform', store).eq('product_id', product.split(':')[0]).eq('active', true).maybeSingle();
    if (mapError) throw mapError;
    if (!mapping || !purchase.expires_date) continue;
    const environment = purchase.is_sandbox === true ? 'sandbox' : purchase.is_sandbox === false ? 'production' : 'unknown';
    if (environment === 'unknown') throw new Error('Ambiente da compra não confirmado pela loja.');
    const { data: existing, error: readError } = await svc.from('subscriptions').select('id,status,current_period_end,environment,auto_renew').eq('user_id', userId).eq('platform', store).in('environment', [environment, 'unknown']).eq('product_id', product.split(':')[0]).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (readError) throw readError;
    const record = {
      user_id: userId, plan_id: mapping.plan_id, platform: store, environment,
      product_id: product.split(':')[0], store_subscription_id: purchase.store_transaction_id ?? null,
      original_transaction_id: store === 'ios' ? purchase.original_transaction_id ?? purchase.store_transaction_id ?? null : null,
      status: storeStatus(purchase.grace_period_expires_date ?? purchase.expires_date, !!purchase.billing_issues_detected_at, !!purchase.refunded_at),
      current_period_start: purchase.purchase_date, current_period_end: purchase.grace_period_expires_date ?? purchase.expires_date,
      auto_renew: !purchase.unsubscribe_detected_at, updated_at: new Date().toISOString(),
    };
    const result = existing ? await svc.from('subscriptions').update(record).eq('id', existing.id).select('id').single() : await svc.from('subscriptions').insert(record).select('id').single();
    const { error } = result;
    if (error) throw new Error(`Falha ao salvar assinatura da loja: ${error.message}`);
    if (!existing || existing.status !== record.status || existing.environment !== environment || Date.parse(existing.current_period_end ?? '') !== Date.parse(record.current_period_end) || existing.auto_renew !== record.auto_renew) {
      await svc.from('subscription_events').insert({ user_id: userId, subscription_id: result.data?.id, platform: store, product_id: record.product_id, event_type: 'provider_verified', raw_payload: { environment, status: record.status, expires_at: record.current_period_end } });
    }
    matched = true;
  }
  const plan = await reconcilePlan(userId);
  if (productId && !matched) throw new Error('A loja ainda não confirmou este pagamento. Tente Restaurar compras em instantes.');
  return { matched, plan };
}
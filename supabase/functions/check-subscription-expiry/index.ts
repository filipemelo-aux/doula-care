import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { serviceClient, reconcilePlan } from '../_shared/subscriptionServer.ts';
import { syncStripeUser } from '../_shared/stripeSync.ts';
import { syncStoreUser } from '../_shared/storeSync.ts';
import { hasSubscriptionAccess, GRACE_MS } from '../_shared/subscriptionRules.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = authenticateCronRequest(req);
  if (authError) return authError;
  const svc = serviceClient();
  try {
    const { data: all, error } = await svc.from('subscriptions').select('user_id,platform,stripe_subscription_id,environment');
    if (error) throw error;
    let checked = 0; let failed = 0;
    for (const userId of new Set((all ?? []).map(s => s.user_id))) {
      try {
        const rows = (all ?? []).filter(s => s.user_id === userId);
        if (rows.some(s => s.stripe_subscription_id)) await syncStripeUser(userId);
        if (rows.some(s => ['ios', 'android'].includes(s.platform))) await syncStoreUser(userId);
        const { data: fresh, error: readError } = await svc.from('subscriptions').select('*').eq('user_id', userId).eq('environment', 'production');
        if (readError) throw readError;
        for (const sub of fresh ?? []) {
          if (!['active', 'pending', 'billing_issue', 'grace_period'].includes(sub.status) || !sub.current_period_end) continue;
          const end = Date.parse(sub.current_period_end);
          const status = end + GRACE_MS <= Date.now() ? 'expired' : end <= Date.now() && sub.status === 'active' ? 'grace_period' : sub.status;
          if (status !== sub.status) {
            const { error: updateError } = await svc.from('subscriptions').update({ status }).eq('id', sub.id).eq('current_period_end', sub.current_period_end);
            if (updateError) throw updateError;
          }
        }
        const plan = await reconcilePlan(userId);
        if (plan === 'free' && (fresh ?? []).some(s => !hasSubscriptionAccess(s))) {
          const { data: profile } = await svc.from('profiles').select('organization_id').eq('user_id', userId).maybeSingle();
          if (profile?.organization_id) {
            const { data: notice, error: noticeError } = await svc.from('org_notifications').select('id').eq('organization_id', profile.organization_id).eq('title', 'Vamos continuar cuidando juntas?').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).limit(1).maybeSingle();
            if (noticeError) throw noticeError;
            if (!notice) await svc.from('org_notifications').insert({ organization_id: profile.organization_id, title: 'Vamos continuar cuidando juntas?', message: 'Não identificamos a renovação da sua assinatura. Seus dados estão preservados e você pode continuar no Free. Acesse Assinatura para regularizar e retomar seus recursos. 💛', type: 'billing' });
          }
        }
        checked++;
      } catch (error) {
        failed++; console.error('Subscription sync failed', userId, error instanceof Error ? error.message : 'error');
        // Provider unavailable: never downgrade from stale data.
      }
    }
    return new Response(JSON.stringify({ checked, failed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Falha na sincronização' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

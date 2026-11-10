import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authenticatedUser, serviceClient } from '../_shared/subscriptionServer.ts';
import { syncStripeUser } from '../_shared/stripeSync.ts';
import { hasSubscriptionAccess } from '../_shared/subscriptionRules.ts';
import { syncStoreUser } from '../_shared/storeSync.ts';

Deno.serve(async req => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return json({});
  try {
    const user = await authenticatedUser(req);
    await syncStripeUser(user.id, user.email);
    const { plan } = await syncStoreUser(user.id);
    const { data, error } = await serviceClient().from('subscriptions').select('*').eq('user_id', user.id);
    if (error) throw error;
    return json({ subscribed: (data ?? []).some(s => hasSubscriptionAccess(s)), plan });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha na confirmação da assinatura' }, 400);
  }
});

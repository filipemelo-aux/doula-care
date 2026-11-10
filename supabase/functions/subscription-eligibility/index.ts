import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { authenticatedUser, purchaseEligibility } from '../_shared/subscriptionServer.ts';
import { syncStripeUser } from '../_shared/stripeSync.ts';
import { syncStoreUser } from '../_shared/storeSync.ts';

Deno.serve(async req => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return json({});
  try {
    const user = await authenticatedUser(req);
    const body = z.object({}).strict().safeParse(await req.json().catch(() => ({})));
    if (!body.success) return json({ error: 'Dados inválidos' }, 400);
    await syncStripeUser(user.id, user.email);
    await syncStoreUser(user.id);
    return json(await purchaseEligibility(user.id));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Não foi possível verificar a assinatura.' }, 400);
  }
});
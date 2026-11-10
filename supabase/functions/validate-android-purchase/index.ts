import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { authenticatedUser } from '../_shared/subscriptionServer.ts';
import { syncStoreUser } from '../_shared/storeSync.ts';

Deno.serve(async req => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return json({});
  try {
    const user = await authenticatedUser(req);
    const parsed = z.object({ product_id: z.string().min(1).max(255) }).passthrough().safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Produto inválido' }, 400);
    const result = await syncStoreUser(user.id, 'android', parsed.data.product_id);
    return json({ success: true, ...result });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha na confirmação da compra' }, 400);
  }
});

import { createClient } from 'npm:@supabase/supabase-js@2';
import { hasSubscriptionAccess } from './subscriptionRules.ts';

export function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
}

export async function authenticatedUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new Error('Não autenticado');
  const svc = serviceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) throw new Error('Não autenticado');
  const { data: role } = await svc.from('user_roles').select('role').eq('user_id', data.user.id).in('role', ['admin', 'super_admin']).limit(1).maybeSingle();
  if (!role) throw new Error('Somente a responsável pode gerenciar a assinatura.');
  return data.user;
}

export async function reconcilePlan(userId: string) {
  const { data, error } = await serviceClient().rpc('reconcile_subscription_plan', { p_user_id: userId });
  if (error) throw error;
  return data;
}

export async function purchaseEligibility(userId: string) {
  const svc = serviceClient();
  const { data: profile, error: profileError } = await svc.from('profiles').select('organization_id').eq('user_id', userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.organization_id) throw new Error('Organização não encontrada.');
  const { data: lifetime, error: promoError } = await svc.from('org_promotions').select('id').eq('organization_id', profile.organization_id).eq('status', 'lifetime_active').limit(1).maybeSingle();
  if (promoError) throw promoError;
  if (lifetime) return { allowed: false, message: 'Sua organização já possui acesso vitalício.' };
  const { data: members, error: memberError } = await svc.from('profiles').select('user_id').eq('organization_id', profile.organization_id);
  if (memberError) throw memberError;
  const { data: rows, error } = await svc.from('subscriptions').select('*').in('user_id', (members ?? []).map(p => p.user_id)).eq('environment', 'production');
  if (error) throw error;
  const existing = (rows ?? []).find(s => hasSubscriptionAccess(s));
  if (!existing) return { allowed: true };
  const provider = existing.platform === 'ios' ? 'App Store' : existing.platform === 'android' ? 'Google Play' : 'web';
  return { allowed: false, platform: existing.platform, message: `Você já possui uma assinatura vigente pela ${provider}. Gerencie essa assinatura antes de contratar outra para evitar duas cobranças.` };
}
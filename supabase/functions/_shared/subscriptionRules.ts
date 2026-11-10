export const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
export interface SubscriptionRecord {
  id?: string;
  status: string;
  environment?: string | null;
  platform?: string | null;
  current_period_end?: string | null;
  created_at?: string;
}

export function hasSubscriptionAccess(s: SubscriptionRecord, now = Date.now()): boolean {
  if (s.environment !== 'production') return false;
  if (!['active', 'pending', 'grace_period', 'billing_issue'].includes(s.status)) return false;
  if (!s.current_period_end) return s.status === 'active';
  const end = Date.parse(s.current_period_end);
  return Number.isFinite(end) && end + GRACE_MS > now;
}

export function selectSubscription<T extends SubscriptionRecord>(rows: T[], now = Date.now()): T | null {
  const production = rows.filter(s => s.environment === 'production');
  return production.sort((a, b) => {
    const access = Number(hasSubscriptionAccess(b, now)) - Number(hasSubscriptionAccess(a, now));
    if (access) return access;
    const active = Number(b.status === 'active') - Number(a.status === 'active');
    if (active) return active;
    return Date.parse(b.current_period_end ?? b.created_at ?? '1970-01-01') - Date.parse(a.current_period_end ?? a.created_at ?? '1970-01-01');
  })[0] ?? null;
}

export function storeStatus(expiresAt: string, billingIssue: boolean, revoked: boolean, now = Date.now()): string {
  if (revoked) return 'expired';
  const end = Date.parse(expiresAt);
  if (end > now) return billingIssue ? 'billing_issue' : 'active';
  return end + GRACE_MS > now ? 'grace_period' : 'expired';
}
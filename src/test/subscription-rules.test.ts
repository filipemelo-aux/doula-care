import { describe, expect, it } from 'vitest';
import { hasSubscriptionAccess, selectSubscription, storeStatus } from '../../supabase/functions/_shared/subscriptionRules';

const now = Date.parse('2026-11-10T14:00:00Z');
const stripe = { id: 'stripe', platform: 'web', environment: 'production', status: 'active', current_period_end: '2026-11-16T01:00:01Z' };
describe('Subscription provider isolation', () => {
  it('keeps real Stripe active despite newer sandbox purchases', () => {
    expect(selectSubscription([stripe, { id: 'ios', environment: 'sandbox', status: 'active', current_period_end: '2027-11-16T00:00:00Z' }], now)?.id).toBe('stripe');
  });
  it('existing Stripe access blocks a new Play Store contract', () => {
    expect(hasSubscriptionAccess(stripe, now)).toBe(true);
  });
  it('unknown and sandbox never grant production access', () => {
    expect(hasSubscriptionAccess({ ...stripe, environment: 'unknown' }, now)).toBe(false);
    expect(hasSubscriptionAccess({ ...stripe, environment: 'sandbox' }, now)).toBe(false);
  });
  it('allows exactly three days of grace, then revokes paid access', () => {
    expect(hasSubscriptionAccess({ ...stripe, status: 'billing_issue', current_period_end: '2026-11-08T14:00:00Z' }, now)).toBe(true);
    expect(hasSubscriptionAccess({ ...stripe, status: 'billing_issue', current_period_end: '2026-11-07T14:00:00Z' }, now)).toBe(false);
  });
  it('cancellation of renewal does not revoke the already paid period', () => {
    expect(storeStatus('2026-11-16T01:00:01Z', false, false, now)).toBe('active');
  });
  it('refund revokes access immediately', () => {
    expect(storeStatus('2026-11-16T01:00:01Z', false, true, now)).toBe('expired');
  });
  it('a valid older subscription takes precedence over a newer expired one', () => {
    expect(selectSubscription([{ id: 'new', environment: 'production', status: 'expired', current_period_end: '2026-11-09T00:00:00Z' }, stripe], now)?.id).toBe('stripe');
  });
});
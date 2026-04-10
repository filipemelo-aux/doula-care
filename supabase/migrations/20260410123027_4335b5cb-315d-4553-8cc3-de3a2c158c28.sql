
-- Update plan_payments: add 'paid' to allowed statuses, simplify
ALTER TABLE public.plan_payments
  DROP CONSTRAINT IF EXISTS plan_payments_billing_type_check;

ALTER TABLE public.plan_payments
  ADD CONSTRAINT plan_payments_status_check CHECK (status IN ('pending', 'paid', 'failed', 'canceled'));

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.platform_plan_limits(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'canceled')),
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique partial index: only 1 active subscription per user
CREATE UNIQUE INDEX idx_subscriptions_one_active_per_user
  ON public.subscriptions (user_id)
  WHERE (status = 'active');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all subscriptions"
  ON public.subscriptions FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

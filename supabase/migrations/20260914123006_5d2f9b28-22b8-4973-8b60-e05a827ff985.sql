ALTER TABLE public.subscription_coupons
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.platform_plan_limits(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS discount_amount bigint,
  ADD COLUMN IF NOT EXISTS duration text NOT NULL DEFAULT 'once';

ALTER TABLE public.subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_billing_period_check;
ALTER TABLE public.subscription_coupons
  ADD CONSTRAINT subscription_coupons_billing_period_check
  CHECK (billing_period IN ('monthly','yearly','both'));

ALTER TABLE public.subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_duration_check;
ALTER TABLE public.subscription_coupons
  ADD CONSTRAINT subscription_coupons_duration_check
  CHECK (duration IN ('once','forever'));

CREATE INDEX IF NOT EXISTS subscription_coupons_code_idx
  ON public.subscription_coupons (upper(code));
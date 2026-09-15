ALTER TABLE public.subscription_coupons
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'amount';

ALTER TABLE public.subscription_coupons
  DROP CONSTRAINT IF EXISTS subscription_coupons_discount_type_check;

ALTER TABLE public.subscription_coupons
  ADD CONSTRAINT subscription_coupons_discount_type_check
  CHECK (discount_type IN ('amount', 'percent'));
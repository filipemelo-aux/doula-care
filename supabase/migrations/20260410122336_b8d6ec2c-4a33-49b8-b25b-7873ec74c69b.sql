
-- Add pricing columns to platform_plan_limits
ALTER TABLE public.platform_plan_limits
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_monthly bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_yearly bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;

-- Populate name and is_free based on plan column
UPDATE public.platform_plan_limits SET name = 'Free', is_free = true WHERE plan = 'free';
UPDATE public.platform_plan_limits SET name = 'Pro', is_free = false WHERE plan = 'pro';
UPDATE public.platform_plan_limits SET name = 'Premium', is_free = false WHERE plan = 'premium';

-- Migrate monthly prices from platform_plan_pricing (converting to centavos)
UPDATE public.platform_plan_limits ppl
SET price_monthly = COALESCE((
  SELECT (ppp.price * 100)::bigint
  FROM public.platform_plan_pricing ppp
  WHERE ppp.plan = ppl.plan AND ppp.billing_cycle = 'monthly' AND ppp.is_active = true
  LIMIT 1
), 0);

-- Migrate yearly prices from platform_plan_pricing (converting to centavos)
UPDATE public.platform_plan_limits ppl
SET price_yearly = COALESCE((
  SELECT (ppp.price * 100)::bigint
  FROM public.platform_plan_pricing ppp
  WHERE ppp.plan = ppl.plan AND ppp.billing_cycle = 'yearly' AND ppp.is_active = true
  LIMIT 1
), 0);

-- Create get_plan_by_id function
CREATE OR REPLACE FUNCTION public.get_plan_by_id(p_plan_id uuid)
RETURNS TABLE(
  id uuid,
  name text,
  price_monthly bigint,
  price_yearly bigint,
  is_free boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ppl.id,
    ppl.name,
    ppl.price_monthly,
    ppl.price_yearly,
    ppl.is_free
  FROM public.platform_plan_limits ppl
  WHERE ppl.id = p_plan_id
  LIMIT 1;
$$;

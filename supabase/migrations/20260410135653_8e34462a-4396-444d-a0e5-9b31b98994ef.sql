ALTER TABLE public.plan_payments
  ADD COLUMN IF NOT EXISTS checkout_slug text,
  ADD COLUMN IF NOT EXISTS checkout_url text;
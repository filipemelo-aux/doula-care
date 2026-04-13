
-- Add gateway-agnostic columns
ALTER TABLE public.plan_payments
  ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT 'mock',
  ADD COLUMN IF NOT EXISTS gateway_payment_id text;

-- Remove InfinitePay-specific columns
ALTER TABLE public.plan_payments
  DROP COLUMN IF EXISTS checkout_slug,
  DROP COLUMN IF EXISTS checkout_url,
  DROP COLUMN IF EXISTS pix_code,
  DROP COLUMN IF EXISTS qr_code_base64,
  DROP COLUMN IF EXISTS infinitepay_response;

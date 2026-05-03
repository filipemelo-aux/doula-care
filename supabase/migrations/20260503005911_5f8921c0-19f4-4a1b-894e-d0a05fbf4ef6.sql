
-- 1) Mapeamento Plano interno <-> Produto da loja
CREATE TABLE IF NOT EXISTS public.plan_store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.platform_plan_limits(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android')),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly','yearly')),
  product_id TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, product_id),
  UNIQUE (plan_id, platform, billing_period)
);

ALTER TABLE public.plan_store_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view store products"
  ON public.plan_store_products FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Super admins manage store products"
  ON public.plan_store_products FOR ALL
  TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE TRIGGER update_plan_store_products_updated_at
  BEFORE UPDATE ON public.plan_store_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Expandir subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS store_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS purchase_token TEXT;

-- relax status check to include new states
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active','pending','canceled','expired','grace_period','billing_issue','free'));

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_platform_check
  CHECK (platform IS NULL OR platform IN ('ios','android','manual','free','mock'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_original_tx
  ON public.subscriptions(original_transaction_id) WHERE original_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_purchase_token
  ON public.subscriptions(purchase_token) WHERE purchase_token IS NOT NULL;

-- 3) Eventos de assinatura
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios','android','manual','mock')),
  event_type TEXT NOT NULL,
  product_id TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription events"
  ON public.subscription_events FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Super admins manage all subscription events"
  ON public.subscription_events FOR ALL
  TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON public.subscription_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_sub ON public.subscription_events(subscription_id, created_at DESC);

-- 4) Pré-popular product IDs sugeridos para Pro e Premium
INSERT INTO public.plan_store_products (plan_id, platform, billing_period, product_id)
SELECT id, p.platform, p.period, 'doula_care_' || ppl.plan || '_' || p.period
FROM public.platform_plan_limits ppl
CROSS JOIN (VALUES ('ios','monthly'),('ios','yearly'),('android','monthly'),('android','yearly')) AS p(platform, period)
WHERE ppl.is_free = false
ON CONFLICT (plan_id, platform, billing_period) DO NOTHING;

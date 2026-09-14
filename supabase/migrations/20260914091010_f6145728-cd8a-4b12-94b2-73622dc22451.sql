CREATE TABLE public.subscription_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  platform text NOT NULL DEFAULT 'both',
  discount_percent integer NOT NULL DEFAULT 0,
  description text,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  redeemed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_coupons_platform_check CHECK (platform IN ('ios','android','both')),
  CONSTRAINT subscription_coupons_percent_check CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

CREATE INDEX idx_subscription_coupons_org ON public.subscription_coupons(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_coupons TO authenticated;
GRANT ALL ON public.subscription_coupons TO service_role;

ALTER TABLE public.subscription_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages coupons"
ON public.subscription_coupons FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "Org members view their active coupons"
ON public.subscription_coupons FOR SELECT TO authenticated
USING (is_active = true AND organization_id = public.get_user_organization_id());

CREATE POLICY "Org members mark their coupon redeemed"
ON public.subscription_coupons FOR UPDATE TO authenticated
USING (is_active = true AND organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE TRIGGER update_subscription_coupons_updated_at
BEFORE UPDATE ON public.subscription_coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.subscription_coupons ALTER COLUMN organization_id DROP NOT NULL;

DROP POLICY IF EXISTS "Org members view their active coupons" ON public.subscription_coupons;
CREATE POLICY "Org members view their active coupons"
ON public.subscription_coupons
FOR SELECT
TO authenticated
USING (is_active = true AND (organization_id IS NULL OR organization_id = public.get_user_organization_id()));
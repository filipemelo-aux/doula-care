
-- Allow dual-role super admins to access org_promotions, org_billing, org_notifications cross-org
-- Safe because all doula dashboard queries already filter by organization_id explicitly

-- org_promotions
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_promotions;
CREATE POLICY "Dual-role org isolation" ON public.org_promotions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- org_billing
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_billing;
CREATE POLICY "Dual-role org isolation" ON public.org_billing
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- org_notifications
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_notifications;
CREATE POLICY "Dual-role org isolation" ON public.org_notifications
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- Enforce tenant isolation for dual-role users (admin/moderator + super_admin)
-- Pure super admins still retain global access because is_org_member() = false for them.

-- organizations: add restrictive tenant isolation so dual-role users only access their own organization outside dedicated RPCs
CREATE POLICY "Dual-role org isolation"
ON public.organizations
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((NOT public.is_org_member()) OR (id = public.get_user_organization_id()))
WITH CHECK ((NOT public.is_org_member()) OR (id = public.get_user_organization_id()));

-- org_billing: remove super-admin bypass from restrictive isolation policy
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_billing;
CREATE POLICY "Dual-role org isolation"
ON public.org_billing
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((NOT public.is_org_member()) OR (organization_id = public.get_user_organization_id()))
WITH CHECK ((NOT public.is_org_member()) OR (organization_id = public.get_user_organization_id()));

-- org_notifications: remove super-admin bypass from restrictive isolation policy
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_notifications;
CREATE POLICY "Dual-role org isolation"
ON public.org_notifications
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((NOT public.is_org_member()) OR (organization_id = public.get_user_organization_id()))
WITH CHECK ((NOT public.is_org_member()) OR (organization_id = public.get_user_organization_id()));

-- org_promotions: remove super-admin bypass from restrictive isolation policy
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_promotions;
CREATE POLICY "Dual-role org isolation"
ON public.org_promotions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((NOT public.is_org_member()) OR (organization_id = public.get_user_organization_id()))
WITH CHECK ((NOT public.is_org_member()) OR (organization_id = public.get_user_organization_id()));
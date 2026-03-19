
-- 2. Restrict moderators from deleting other moderators' roles
-- Drop and recreate the DELETE policy on user_roles

DROP POLICY IF EXISTS "Moderators can delete non-admin roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete org user roles" ON public.user_roles;

-- Admins can delete roles for users in their org (except super_admin roles)
CREATE POLICY "Admins can delete org user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND role != 'super_admin'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.organization_id = get_user_organization_id()
  )
);

-- 3. Restrict org billing/email visibility from clients
-- The organizations SELECT policy already restricts via get_user_organization_id()
-- but clients can see org details. Let's tighten it:
DROP POLICY IF EXISTS "Users can view own organization" ON public.organizations;

-- Admins/moderators see full org details
CREATE POLICY "Admins can view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND id = get_user_organization_id()
);

-- Clients can view limited org info (only for branding purposes - name, logo, colors)
CREATE POLICY "Clients can view own organization branding"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND id = get_user_organization_id()
);

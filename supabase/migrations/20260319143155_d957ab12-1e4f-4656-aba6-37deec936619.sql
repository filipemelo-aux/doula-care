DROP POLICY IF EXISTS "Moderators can insert org roles" ON public.user_roles;

CREATE POLICY "Moderators can insert org roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'moderator'::app_role)
  AND role NOT IN ('admin', 'super_admin', 'moderator')
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.organization_id = get_user_organization_id()
  )
);
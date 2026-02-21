-- Allow admins and moderators to view all profiles for user management
CREATE POLICY "Admins and moderators can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to view all non-admin roles
CREATE POLICY "Moderators can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to manage non-admin roles (insert, update, delete)
CREATE POLICY "Moderators can insert non-admin roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'moderator'::app_role)
  AND role != 'admin'::app_role
);

CREATE POLICY "Moderators can update non-admin roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'moderator'::app_role)
  AND role != 'admin'::app_role
);

CREATE POLICY "Moderators can delete non-admin roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'moderator'::app_role)
  AND role != 'admin'::app_role
);
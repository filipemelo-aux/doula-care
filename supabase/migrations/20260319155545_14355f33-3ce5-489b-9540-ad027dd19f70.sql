
-- Allow clients to view profiles of users in their own organization (for forum author display)
CREATE POLICY "Clients can view org profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND organization_id IS NOT NULL
  AND organization_id = get_user_organization_id()
);

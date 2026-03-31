
CREATE POLICY "Clients can view own org pix settings"
ON public.admin_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'client'::app_role)
  AND organization_id = get_user_organization_id()
);

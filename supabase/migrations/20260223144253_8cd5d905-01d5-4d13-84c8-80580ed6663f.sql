-- Allow admins to update branding fields on their own organization
CREATE POLICY "Admins can update own org branding"
  ON public.organizations
  FOR UPDATE
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    AND id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    AND id = get_user_organization_id()
  );
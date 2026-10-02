CREATE POLICY "Org moderators manage service records" ON public.service_records FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(), 'moderator'));
CREATE POLICY "Org moderators manage plan settings" ON public.plan_settings FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(), 'moderator'));
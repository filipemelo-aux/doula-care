
CREATE TABLE public.custom_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🔧',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.custom_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage org custom services"
  ON public.custom_services
  FOR ALL
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    AND organization_id = get_user_organization_id()
  );

CREATE POLICY "Super admins can manage all custom services"
  ON public.custom_services
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

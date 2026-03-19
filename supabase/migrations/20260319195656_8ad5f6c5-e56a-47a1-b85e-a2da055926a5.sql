
-- Create a helper function to check if user has admin/moderator role (for RESTRICTIVE policies)
CREATE OR REPLACE FUNCTION public.is_org_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'moderator')
  )
$$;

-- RESTRICTIVE policies: when user has admin/moderator role, force org isolation
-- These use AND logic with existing permissive policies

-- clients
CREATE POLICY "Dual-role org isolation" ON public.clients
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- appointments
CREATE POLICY "Dual-role org isolation" ON public.appointments
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- client_notifications
CREATE POLICY "Dual-role org isolation" ON public.client_notifications
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- client_contracts
CREATE POLICY "Dual-role org isolation" ON public.client_contracts
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- payments
CREATE POLICY "Dual-role org isolation" ON public.payments
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- transactions (has organization_id)
CREATE POLICY "Dual-role org isolation" ON public.transactions
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
  OR organization_id IS NULL
);

-- pregnancy_diary
CREATE POLICY "Dual-role org isolation" ON public.pregnancy_diary
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- contractions
CREATE POLICY "Dual-role org isolation" ON public.contractions
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- service_requests
CREATE POLICY "Dual-role org isolation" ON public.service_requests
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- appointment_requests
CREATE POLICY "Dual-role org isolation" ON public.appointment_requests
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- plan_settings
CREATE POLICY "Dual-role org isolation" ON public.plan_settings
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
  OR organization_id IS NULL
);

-- custom_services
CREATE POLICY "Dual-role org isolation" ON public.custom_services
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- doula_availability
CREATE POLICY "Dual-role org isolation" ON public.doula_availability
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- admin_settings
CREATE POLICY "Dual-role org isolation" ON public.admin_settings
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- org_notifications
CREATE POLICY "Dual-role org isolation" ON public.org_notifications
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- org_billing
CREATE POLICY "Dual-role org isolation" ON public.org_billing
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

-- org_promotions
CREATE POLICY "Dual-role org isolation" ON public.org_promotions
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT is_org_member()
  OR organization_id = get_user_organization_id()
);

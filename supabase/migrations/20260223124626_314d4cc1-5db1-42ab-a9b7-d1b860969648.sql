
-- =============================================
-- FASE 1B: RLS policies com organization_id isolation + super_admin
-- =============================================

-- Helper: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

-- Organizations RLS
CREATE POLICY "Super admins can manage all organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "Users can view own organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = get_user_organization_id());

-- Clients: replace old policy with org-scoped
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
CREATE POLICY "Admins can manage org clients"
  ON public.clients FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Transactions
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
CREATE POLICY "Admins can manage org transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Payments
DROP POLICY IF EXISTS "Admins can manage own payments" ON public.payments;
CREATE POLICY "Admins can manage org payments"
  ON public.payments FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Appointments
DROP POLICY IF EXISTS "Admins and moderators can manage all appointments" ON public.appointments;
CREATE POLICY "Admins can manage org appointments"
  ON public.appointments FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Pregnancy diary
DROP POLICY IF EXISTS "Admins and moderators can manage all diary entries" ON public.pregnancy_diary;
CREATE POLICY "Admins can manage org diary entries"
  ON public.pregnancy_diary FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Client notifications
DROP POLICY IF EXISTS "Admins and moderators can manage all notifications" ON public.client_notifications;
CREATE POLICY "Admins can manage org notifications"
  ON public.client_notifications FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Contractions
DROP POLICY IF EXISTS "Admins and moderators can manage all contractions" ON public.contractions;
CREATE POLICY "Admins can manage org contractions"
  ON public.contractions FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Service requests
DROP POLICY IF EXISTS "Admins and moderators can manage all service requests" ON public.service_requests;
CREATE POLICY "Admins can manage org service requests"
  ON public.service_requests FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Plan settings
DROP POLICY IF EXISTS "Admins can manage plan settings" ON public.plan_settings;
CREATE POLICY "Admins can manage org plan settings"
  ON public.plan_settings FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND organization_id = get_user_organization_id()
  );

-- Admin settings
DROP POLICY IF EXISTS "Admins can manage own settings" ON public.admin_settings;
CREATE POLICY "Admins can manage org settings"
  ON public.admin_settings FOR ALL TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

-- Super admin: access all data across orgs
CREATE POLICY "Super admins can manage all clients"
  ON public.clients FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all payments"
  ON public.payments FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage all appointments"
  ON public.appointments FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can view all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

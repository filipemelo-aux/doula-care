
-- ═══════════════════════════════════════════════════════════
-- MULTI-TENANT ISOLATION HARDENING
-- Fix all RLS policies that leak data across organizations
-- ═══════════════════════════════════════════════════════════

-- 1. CLIENTS: Remove cross-org admin leak from SELECT policy
DROP POLICY IF EXISTS "Clients can view own data" ON public.clients;
CREATE POLICY "Clients can view own data"
  ON public.clients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. CLIENT_NOTIFICATIONS: Remove cross-org admin/moderator leak
DROP POLICY IF EXISTS "Clients can view own notifications" ON public.client_notifications;
CREATE POLICY "Clients can view own notifications"
  ON public.client_notifications FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = client_notifications.client_id AND c.user_id = auth.uid()
  ));

-- 3. CONTRACTIONS: Remove cross-org admin/moderator leak
DROP POLICY IF EXISTS "Clients can view own contractions" ON public.contractions;
CREATE POLICY "Clients can view own contractions"
  ON public.contractions FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = contractions.client_id AND c.user_id = auth.uid()
  ));

-- 4. PREGNANCY_DIARY: Remove cross-org admin/moderator leak
DROP POLICY IF EXISTS "Clients can view own diary entries" ON public.pregnancy_diary;
CREATE POLICY "Clients can view own diary entries"
  ON public.pregnancy_diary FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = pregnancy_diary.client_id AND c.user_id = auth.uid()
  ));

-- 5. ADMIN_SETTINGS: Restrict read to own org only
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.admin_settings;
CREATE POLICY "Users can view own org settings"
  ON public.admin_settings FOR SELECT
  TO authenticated
  USING (organization_id = get_user_organization_id());

-- 6. PROFILES: Restrict admin/moderator view to same org
DROP POLICY IF EXISTS "Admins and moderators can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view org profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    AND organization_id = get_user_organization_id()
  );

-- Super admin can see all profiles
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- 7. PLAN_SETTINGS: Restrict active plan view to own org
DROP POLICY IF EXISTS "Authenticated users can view active plans" ON public.plan_settings;
CREATE POLICY "Users can view own org active plans"
  ON public.plan_settings FOR SELECT
  TO authenticated
  USING (is_active = true AND organization_id = get_user_organization_id());

-- 8. Add super_admin policies to tables missing them
-- pregnancy_diary
CREATE POLICY "Super admins can manage all diary entries"
  ON public.pregnancy_diary FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- contractions
CREATE POLICY "Super admins can manage all contractions"
  ON public.contractions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- client_notifications
CREATE POLICY "Super admins can manage all notifications"
  ON public.client_notifications FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- admin_settings
CREATE POLICY "Super admins can manage all settings"
  ON public.admin_settings FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- plan_settings: add super_admin policy
CREATE POLICY "Super admins can manage all plan settings"
  ON public.plan_settings FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- service_requests: add super_admin policy
CREATE POLICY "Super admins can manage all service requests"
  ON public.service_requests FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- push_subscriptions: add org-scoped admin view
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins can view org subscriptions"
  ON public.push_subscriptions FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.user_id = push_subscriptions.user_id
        AND c.organization_id = get_user_organization_id()
    )
  );

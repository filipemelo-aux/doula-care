
-- Update all RESTRICTIVE "Dual-role org isolation" policies to bypass for super_admins
-- This ensures dual-role users (admin + super_admin) can see all data on the super admin dashboard

-- Drop and recreate each policy with the super_admin bypass

-- clients
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.clients;
CREATE POLICY "Dual-role org isolation" ON public.clients
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- appointments
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.appointments;
CREATE POLICY "Dual-role org isolation" ON public.appointments
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- client_notifications
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.client_notifications;
CREATE POLICY "Dual-role org isolation" ON public.client_notifications
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- client_contracts
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.client_contracts;
CREATE POLICY "Dual-role org isolation" ON public.client_contracts
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- payments
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.payments;
CREATE POLICY "Dual-role org isolation" ON public.payments
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- transactions
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.transactions;
CREATE POLICY "Dual-role org isolation" ON public.transactions
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id() OR organization_id IS NULL);

-- pregnancy_diary
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.pregnancy_diary;
CREATE POLICY "Dual-role org isolation" ON public.pregnancy_diary
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- contractions
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.contractions;
CREATE POLICY "Dual-role org isolation" ON public.contractions
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- service_requests
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.service_requests;
CREATE POLICY "Dual-role org isolation" ON public.service_requests
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- appointment_requests
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.appointment_requests;
CREATE POLICY "Dual-role org isolation" ON public.appointment_requests
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- plan_settings
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.plan_settings;
CREATE POLICY "Dual-role org isolation" ON public.plan_settings
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id() OR organization_id IS NULL);

-- custom_services
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.custom_services;
CREATE POLICY "Dual-role org isolation" ON public.custom_services
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- doula_availability
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.doula_availability;
CREATE POLICY "Dual-role org isolation" ON public.doula_availability
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- admin_settings
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.admin_settings;
CREATE POLICY "Dual-role org isolation" ON public.admin_settings
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- org_notifications
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_notifications;
CREATE POLICY "Dual-role org isolation" ON public.org_notifications
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- org_billing
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_billing;
CREATE POLICY "Dual-role org isolation" ON public.org_billing
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

-- org_promotions
DROP POLICY IF EXISTS "Dual-role org isolation" ON public.org_promotions;
CREATE POLICY "Dual-role org isolation" ON public.org_promotions
AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT is_org_member() OR is_super_admin() OR organization_id = get_user_organization_id());

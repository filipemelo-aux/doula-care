DROP POLICY IF EXISTS "Authenticated can read public system_config keys" ON public.system_config;

CREATE POLICY "Authenticated can read public system_config keys"
ON public.system_config
FOR SELECT
TO authenticated
USING (
  key = 'force_update_at'
  OR key LIKE 'platform_pix_%'
  OR (key LIKE 'revenuecat_%' AND (public.is_org_member() OR public.is_super_admin()))
);
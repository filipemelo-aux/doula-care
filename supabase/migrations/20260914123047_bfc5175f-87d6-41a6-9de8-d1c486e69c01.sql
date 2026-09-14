DROP POLICY IF EXISTS "Authenticated can read public system_config keys" ON public.system_config;
CREATE POLICY "Authenticated can read public system_config keys"
ON public.system_config FOR SELECT
USING (
  (key = 'force_update_at')
  OR (key = 'hide_free_plan')
  OR (key ~~ 'platform_pix_%')
  OR ((key ~~ 'revenuecat_%') AND (is_org_member() OR is_super_admin()))
);
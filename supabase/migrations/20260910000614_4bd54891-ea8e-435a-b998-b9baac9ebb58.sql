DROP POLICY IF EXISTS "Authenticated can read public system_config keys" ON public.system_config;
CREATE POLICY "Authenticated can read public system_config keys"
ON public.system_config
FOR SELECT
TO authenticated
USING (
  key = 'force_update_at'
  OR key LIKE 'platform_pix_%'
  OR key LIKE 'revenuecat_%'
);
INSERT INTO public.system_config (key, value)
VALUES ('revenuecat_ios_key', ''), ('revenuecat_android_key', '')
ON CONFLICT (key) DO NOTHING;
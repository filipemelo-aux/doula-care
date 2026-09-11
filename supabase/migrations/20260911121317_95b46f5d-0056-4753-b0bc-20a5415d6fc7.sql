INSERT INTO public.system_config (key, value)
VALUES ('signup_maintenance', 'on'), ('signup_maintenance_until', '2026-09-12T12:00:00Z')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

DROP POLICY IF EXISTS "Public can read signup maintenance flags" ON public.system_config;
CREATE POLICY "Public can read signup maintenance flags"
ON public.system_config
FOR SELECT
TO anon, authenticated
USING (key LIKE 'signup_maintenance%');

GRANT SELECT ON public.system_config TO anon;
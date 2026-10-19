CREATE POLICY "Public can read android force update flag" ON public.system_config FOR SELECT TO anon, authenticated USING (key = 'android_force_update');

CREATE TABLE public.association_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_name text NOT NULL,
  president_name text NOT NULL,
  president_phone text,
  doulas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.association_submissions TO anon, authenticated;
GRANT SELECT, DELETE ON public.association_submissions TO authenticated;
GRANT ALL ON public.association_submissions TO service_role;
ALTER TABLE public.association_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit association list" ON public.association_submissions FOR INSERT TO anon, authenticated
WITH CHECK (length(association_name) BETWEEN 2 AND 200 AND length(president_name) BETWEEN 2 AND 200 AND jsonb_typeof(doulas) = 'array' AND jsonb_array_length(doulas) BETWEEN 1 AND 300);
CREATE POLICY "Super admins read association lists" ON public.association_submissions FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admins delete association lists" ON public.association_submissions FOR DELETE TO authenticated USING (public.is_super_admin());
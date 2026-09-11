CREATE TABLE public.doula_personal_data (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  cpf text,
  birth_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.doula_personal_data TO authenticated;
GRANT ALL ON public.doula_personal_data TO service_role;

ALTER TABLE public.doula_personal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own personal data"
ON public.doula_personal_data FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can view personal data"
ON public.doula_personal_data FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE TRIGGER update_doula_personal_data_updated_at
BEFORE UPDATE ON public.doula_personal_data
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lgpd_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_consent_version text,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS doula_training text,
  ADD COLUMN IF NOT EXISTS practice_since integer;
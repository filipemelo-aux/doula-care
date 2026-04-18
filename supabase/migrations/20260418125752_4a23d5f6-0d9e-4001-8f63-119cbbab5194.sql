
-- ============================================
-- Tabela para declarações de pagamento via Pix das assinaturas
-- ============================================
CREATE TABLE IF NOT EXISTS public.plan_pix_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.platform_plan_limits(id) ON DELETE RESTRICT,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('monthly','yearly')),
  amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation'
    CHECK (status IN ('awaiting_confirmation','approved','rejected')),
  declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_pix_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own pix payments"
ON public.plan_pix_payments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own pix payments"
ON public.plan_pix_payments FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all pix payments"
ON public.plan_pix_payments FOR ALL TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE TRIGGER update_plan_pix_payments_updated_at
BEFORE UPDATE ON public.plan_pix_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_plan_pix_payments_status ON public.plan_pix_payments(status, declared_at DESC);
CREATE INDEX idx_plan_pix_payments_user ON public.plan_pix_payments(user_id);

-- ============================================
-- Seed das chaves de configuração Pix da plataforma em system_config
-- (system_config já existe; só garantimos as chaves)
-- ============================================
INSERT INTO public.system_config (key, value)
VALUES
  ('platform_pix_key', ''),
  ('platform_pix_key_type', 'random'),
  ('platform_pix_beneficiary', 'Doula Care'),
  ('platform_pix_city', 'SAO PAULO')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- system_config: permitir leitura por usuários autenticados das chaves Pix
-- (Super admins já podem por outras políticas; precisamos liberar SELECT específico)
-- ============================================
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='system_config'
      AND policyname='Authenticated can read pix config'
  ) THEN
    CREATE POLICY "Authenticated can read pix config"
    ON public.system_config FOR SELECT TO authenticated
    USING (key LIKE 'platform_pix_%');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='system_config'
      AND policyname='Super admins manage system_config'
  ) THEN
    CREATE POLICY "Super admins manage system_config"
    ON public.system_config FOR ALL TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());
  END IF;
END $$;

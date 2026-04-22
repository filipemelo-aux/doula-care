
-- Campos em organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS service_areas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS accepts_new_clients BOOLEAN NOT NULL DEFAULT true;

-- Campos em clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_visitor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visitor_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS visitor_longitude NUMERIC;

-- Tabela doula_match_requests
CREATE TABLE IF NOT EXISTS public.doula_match_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_user_id UUID NOT NULL,
  visitor_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_setting_id UUID REFERENCES public.plan_settings(id) ON DELETE SET NULL,
  plan_name TEXT,
  plan_value NUMERIC,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  responded_by UUID,
  response_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS doula_match_requests_one_pending_per_visitor
  ON public.doula_match_requests(visitor_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_doula_match_requests_org ON public.doula_match_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_doula_match_requests_visitor ON public.doula_match_requests(visitor_user_id, status);

ALTER TABLE public.doula_match_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_doula_match_requests_updated_at ON public.doula_match_requests;
CREATE TRIGGER update_doula_match_requests_updated_at
  BEFORE UPDATE ON public.doula_match_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Visitors can view own match requests" ON public.doula_match_requests;
CREATE POLICY "Visitors can view own match requests"
  ON public.doula_match_requests FOR SELECT TO authenticated
  USING (visitor_user_id = auth.uid());

DROP POLICY IF EXISTS "Visitors can create own match requests" ON public.doula_match_requests;
CREATE POLICY "Visitors can create own match requests"
  ON public.doula_match_requests FOR INSERT TO authenticated
  WITH CHECK (visitor_user_id = auth.uid() AND has_role(auth.uid(), 'visitor'::app_role));

DROP POLICY IF EXISTS "Visitors can cancel own pending requests" ON public.doula_match_requests;
CREATE POLICY "Visitors can cancel own pending requests"
  ON public.doula_match_requests FOR UPDATE TO authenticated
  USING (visitor_user_id = auth.uid() AND status = 'pending')
  WITH CHECK (visitor_user_id = auth.uid());

DROP POLICY IF EXISTS "Doulas can view own org match requests" ON public.doula_match_requests;
CREATE POLICY "Doulas can view own org match requests"
  ON public.doula_match_requests FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
         AND organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Doulas can respond to own org match requests" ON public.doula_match_requests;
CREATE POLICY "Doulas can respond to own org match requests"
  ON public.doula_match_requests FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
         AND organization_id = get_user_organization_id())
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
              AND organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Super admins manage all match requests" ON public.doula_match_requests;
CREATE POLICY "Super admins manage all match requests"
  ON public.doula_match_requests FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Funções públicas de descoberta
CREATE OR REPLACE FUNCTION public.get_public_doulas()
RETURNS TABLE(
  id UUID, name TEXT, nome_exibicao TEXT, logo_url TEXT, bio TEXT,
  city TEXT, state TEXT, neighborhood TEXT, service_areas TEXT[],
  latitude NUMERIC, longitude NUMERIC, primary_color TEXT, secondary_color TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.name, o.nome_exibicao, o.logo_url, o.bio,
         o.city, o.state, o.neighborhood, o.service_areas,
         o.latitude, o.longitude, o.primary_color, o.secondary_color
  FROM public.organizations o
  WHERE o.status = 'ativo' AND o.accepts_new_clients = true;
$$;

CREATE OR REPLACE FUNCTION public.get_public_doula_plans(p_organization_id UUID)
RETURNS TABLE(
  id UUID, name TEXT, description TEXT, default_value NUMERIC,
  features TEXT[], plan_type plan_type
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ps.id, ps.name, ps.description, ps.default_value, ps.features, ps.plan_type
  FROM public.plan_settings ps
  JOIN public.organizations o ON o.id = ps.organization_id
  WHERE ps.organization_id = p_organization_id
    AND ps.is_active = true
    AND o.status = 'ativo' AND o.accepts_new_clients = true
  ORDER BY ps.default_value ASC;
$$;

-- Visitante cria solicitação
CREATE OR REPLACE FUNCTION public.create_doula_match_request(
  p_organization_id UUID, p_plan_setting_id UUID, p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_client_id UUID;
  v_plan_name TEXT;
  v_plan_value NUMERIC;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT has_role(v_user_id, 'visitor'::app_role) THEN
    RAISE EXCEPTION 'Apenas visitantes podem solicitar vínculo';
  END IF;

  SELECT id INTO v_client_id FROM public.clients
  WHERE user_id = v_user_id AND is_visitor = true LIMIT 1;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'Perfil de visitante não encontrado'; END IF;

  SELECT ps.name, ps.default_value INTO v_plan_name, v_plan_value
  FROM public.plan_settings ps
  WHERE ps.id = p_plan_setting_id AND ps.organization_id = p_organization_id AND ps.is_active = true;
  IF v_plan_name IS NULL THEN RAISE EXCEPTION 'Plano inválido'; END IF;

  UPDATE public.doula_match_requests
  SET status = 'cancelled', updated_at = now()
  WHERE visitor_user_id = v_user_id AND status = 'pending';

  INSERT INTO public.doula_match_requests
    (visitor_user_id, visitor_client_id, organization_id, plan_setting_id, plan_name, plan_value, message)
  VALUES (v_user_id, v_client_id, p_organization_id, p_plan_setting_id, v_plan_name, v_plan_value, p_message)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Doula aprova
CREATE OR REPLACE FUNCTION public.approve_doula_match_request(
  p_request_id UUID, p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
  v_request RECORD;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_org_id := get_user_organization_id();
  IF v_org_id IS NULL OR NOT (has_role(v_user_id, 'admin'::app_role) OR has_role(v_user_id, 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO v_request FROM public.doula_match_requests
  WHERE id = p_request_id AND organization_id = v_org_id AND status = 'pending'
  FOR UPDATE;
  IF v_request.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada ou já respondida'; END IF;

  UPDATE public.clients
  SET organization_id = v_org_id, owner_id = v_user_id, is_visitor = false,
      plan_setting_id = v_request.plan_setting_id,
      plan_value = COALESCE(v_request.plan_value, 0),
      payment_status = 'pendente'::payment_status, updated_at = now()
  WHERE id = v_request.visitor_client_id;

  DELETE FROM public.user_roles WHERE user_id = v_request.visitor_user_id AND role = 'visitor'::app_role;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_request.visitor_user_id, 'client'::app_role)
  ON CONFLICT DO NOTHING;

  UPDATE public.doula_match_requests
  SET status = 'approved', responded_at = now(), responded_by = v_user_id, response_notes = p_notes, updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.client_notifications (client_id, organization_id, title, message)
  VALUES (v_request.visitor_client_id, v_org_id,
          'Bem-vinda! Vínculo aprovado',
          'Sua doula aprovou seu vínculo. Agora você tem acesso completo à plataforma.');
END;
$$;

-- Doula rejeita
CREATE OR REPLACE FUNCTION public.reject_doula_match_request(
  p_request_id UUID, p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID := auth.uid(); v_org_id UUID;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_org_id := get_user_organization_id();
  IF v_org_id IS NULL OR NOT (has_role(v_user_id, 'admin'::app_role) OR has_role(v_user_id, 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.doula_match_requests
  SET status = 'rejected', responded_at = now(), responded_by = v_user_id, response_notes = p_notes, updated_at = now()
  WHERE id = p_request_id AND organization_id = v_org_id AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_doulas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_doula_plans(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_doula_match_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_doula_match_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_doula_match_request(UUID, TEXT) TO authenticated;

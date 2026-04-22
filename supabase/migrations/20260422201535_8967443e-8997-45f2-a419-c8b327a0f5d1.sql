-- Update approve_doula_match_request to also sync profiles.organization_id
-- This is required so that get_user_organization_id() (used by RLS) returns the
-- correct org for clients that were originally registered as visitors.
CREATE OR REPLACE FUNCTION public.approve_doula_match_request(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Sync profile.organization_id so RLS helper get_user_organization_id() returns the right org
  UPDATE public.profiles
  SET organization_id = v_org_id, updated_at = now()
  WHERE user_id = v_request.visitor_user_id;

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
$function$;

-- Backfill existing approved visitors-turned-clients whose profile is missing organization_id
UPDATE public.profiles p
SET organization_id = c.organization_id, updated_at = now()
FROM public.clients c
WHERE p.user_id = c.user_id
  AND c.organization_id IS NOT NULL
  AND p.organization_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = c.user_id AND ur.role = 'client'
  );
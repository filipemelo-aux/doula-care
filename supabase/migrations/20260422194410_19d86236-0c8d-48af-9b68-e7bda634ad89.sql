CREATE OR REPLACE FUNCTION public.get_org_match_requests()
RETURNS TABLE(
  id uuid,
  visitor_client_id uuid,
  visitor_user_id uuid,
  organization_id uuid,
  plan_setting_id uuid,
  plan_name text,
  plan_value numeric,
  message text,
  status text,
  created_at timestamptz,
  client_full_name text,
  client_preferred_name text,
  client_phone text,
  client_city text,
  client_state text,
  client_dpp date,
  client_pregnancy_weeks integer,
  client_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    dmr.id,
    dmr.visitor_client_id,
    dmr.visitor_user_id,
    dmr.organization_id,
    dmr.plan_setting_id,
    dmr.plan_name,
    dmr.plan_value,
    dmr.message,
    dmr.status,
    dmr.created_at,
    c.full_name,
    c.preferred_name,
    c.phone,
    c.city,
    c.state,
    c.dpp,
    c.pregnancy_weeks,
    c.status::text
  FROM public.doula_match_requests dmr
  JOIN public.clients c ON c.id = dmr.visitor_client_id
  WHERE dmr.status = 'pending'
    AND dmr.organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  ORDER BY dmr.created_at DESC;
$$;
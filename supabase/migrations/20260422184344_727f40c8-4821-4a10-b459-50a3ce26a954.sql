ALTER TABLE public.plan_settings
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_plan_settings_org_sort
ON public.plan_settings(organization_id, sort_order);

CREATE OR REPLACE FUNCTION public.get_public_doula_plans(p_organization_id uuid)
 RETURNS TABLE(id uuid, name text, description text, default_value numeric, features text[], plan_type plan_type)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ps.id, ps.name, ps.description, ps.default_value, ps.features, ps.plan_type
  FROM public.plan_settings ps
  JOIN public.organizations o ON o.id = ps.organization_id
  WHERE ps.organization_id = p_organization_id
    AND ps.is_active = true
    AND o.status = 'ativo' AND o.accepts_new_clients = true
  ORDER BY ps.sort_order ASC, ps.default_value ASC;
$function$;
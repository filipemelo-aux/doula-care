ALTER TABLE public.org_access_log ADD COLUMN IF NOT EXISTS platform text;

DROP FUNCTION IF EXISTS public.get_org_last_access();

CREATE FUNCTION public.get_org_last_access()
 RETURNS TABLE(organization_id uuid, last_access timestamp with time zone, platform text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (l.organization_id)
    l.organization_id,
    l.accessed_at as last_access,
    l.platform
  from public.org_access_log l
  where public.is_super_admin()
  order by l.organization_id, l.accessed_at desc
$function$;
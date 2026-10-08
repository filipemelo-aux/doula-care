DROP FUNCTION IF EXISTS public.get_org_client_counts();
CREATE FUNCTION public.get_org_client_counts()
RETURNS TABLE(organization_id uuid, client_count bigint, gestante_count bigint, puerpera_count bigint, avulsa_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.organization_id,
    COUNT(*) FILTER (WHERE c.status = 'gestante' AND COALESCE(c.birth_occurred,false) = false)::bigint,
    COUNT(*) FILTER (WHERE c.status = 'gestante' AND COALESCE(c.birth_occurred,false) = false)::bigint,
    COUNT(*) FILTER (WHERE c.status = 'lactante' OR (c.status = 'gestante' AND c.birth_occurred = true))::bigint,
    COUNT(*) FILTER (WHERE c.status IN ('outro','tentante'))::bigint
  FROM public.clients c
  WHERE c.organization_id IS NOT NULL AND COALESCE(c.is_visitor,false) = false
  GROUP BY c.organization_id
$$;
REVOKE EXECUTE ON FUNCTION public.get_org_client_counts() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_org_client_counts() TO authenticated;
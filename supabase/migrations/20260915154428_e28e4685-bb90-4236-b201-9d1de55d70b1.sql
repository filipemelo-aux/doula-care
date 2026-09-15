CREATE OR REPLACE FUNCTION public.get_org_last_access()
RETURNS TABLE(organization_id uuid, last_access timestamp with time zone, platform text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    a.organization_id,
    a.last_access,
    p.platform
  from (
    select l.organization_id, max(l.accessed_at) as last_access
    from public.org_access_log l
    where public.is_super_admin()
    group by l.organization_id
  ) a
  left join lateral (
    select l2.platform
    from public.org_access_log l2
    where l2.organization_id = a.organization_id
      and l2.platform is not null
    order by l2.accessed_at desc
    limit 1
  ) p on true
$$;
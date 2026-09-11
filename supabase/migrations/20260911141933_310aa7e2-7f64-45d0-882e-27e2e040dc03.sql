create or replace function public.get_org_last_access()
returns table(organization_id uuid, last_access timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.organization_id, max(l.accessed_at) as last_access
  from public.org_access_log l
  where public.is_super_admin()
  group by l.organization_id
$$;

grant execute on function public.get_org_last_access() to authenticated;
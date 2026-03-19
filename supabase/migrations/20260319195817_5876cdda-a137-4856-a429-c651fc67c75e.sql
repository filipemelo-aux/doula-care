
CREATE OR REPLACE FUNCTION public.get_master_super_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT au.id
  FROM auth.users au
  WHERE au.email = 'filipe.silvamelo@live.com'
  LIMIT 1
$$;

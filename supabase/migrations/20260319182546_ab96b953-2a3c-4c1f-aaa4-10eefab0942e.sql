
CREATE OR REPLACE FUNCTION public.get_forum_author_name(p_author_id uuid, p_is_anonymous boolean)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_is_anonymous AND p_author_id != auth.uid() THEN 'Anônima'
    WHEN EXISTS(SELECT 1 FROM user_roles WHERE user_id = p_author_id AND role = 'super_admin') THEN 'Doula Care'
    ELSE (
      SELECT COALESCE(p.full_name, c.preferred_name, c.full_name, 'Usuário')
      FROM (SELECT 1) dummy
      LEFT JOIN profiles p ON p.user_id = p_author_id
      LEFT JOIN clients c ON c.user_id = p_author_id
      LIMIT 1
    )
  END;
$$;

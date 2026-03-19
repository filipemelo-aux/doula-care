
CREATE OR REPLACE FUNCTION public.get_forum_author_profiles(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, is_doula boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    u.id AS user_id,
    COALESCE(
      CASE WHEN r.is_doula THEN p.full_name END,
      c.preferred_name,
      c.full_name,
      p.full_name,
      'Usuária'
    ) AS display_name,
    COALESCE(
      CASE WHEN r.is_doula AND p.organization_id IS NOT NULL THEN o.logo_url END,
      p.avatar_url
    ) AS avatar_url,
    COALESCE(r.is_doula, false) AS is_doula
  FROM unnest(p_user_ids) AS u(id)
  LEFT JOIN profiles p ON p.user_id = u.id
  LEFT JOIN clients c ON c.user_id = u.id
  LEFT JOIN organizations o ON o.id = p.organization_id
  LEFT JOIN LATERAL (
    SELECT EXISTS(
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = u.id AND ur.role IN ('admin', 'moderator')
    ) AS is_doula
  ) r ON true;
$$;

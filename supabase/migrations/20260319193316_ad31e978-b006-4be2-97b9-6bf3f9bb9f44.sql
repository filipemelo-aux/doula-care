
-- Add is_system_post flag to forum_posts
ALTER TABLE public.forum_posts ADD COLUMN IF NOT EXISTS is_system_post boolean NOT NULL DEFAULT false;

-- Update get_forum_author_profiles to NOT force "Doula Care" for super_admins
-- Let the frontend handle system post identity based on is_system_post flag
CREATE OR REPLACE FUNCTION public.get_forum_author_profiles(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, is_doula boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    COALESCE(r.is_doula, false) OR COALESCE(r.is_super_admin, false) AS is_doula
  FROM unnest(p_user_ids) AS u(id)
  LEFT JOIN profiles p ON p.user_id = u.id
  LEFT JOIN clients c ON c.user_id = u.id
  LEFT JOIN organizations o ON o.id = p.organization_id
  LEFT JOIN LATERAL (
    SELECT 
      EXISTS(
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = u.id AND ur.role IN ('admin', 'moderator')
      ) AS is_doula,
      EXISTS(
        SELECT 1 FROM user_roles ur
        WHERE ur.user_id = u.id AND ur.role = 'super_admin'
      ) AS is_super_admin
  ) r ON true;
$$;

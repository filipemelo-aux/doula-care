
-- Add audience column to forum_posts
ALTER TABLE public.forum_posts ADD COLUMN audience text NOT NULL DEFAULT 'all';

-- Update the SELECT RLS policy for clients to exclude doulas_only posts
DROP POLICY IF EXISTS "Authenticated users can view visible posts" ON public.forum_posts;

CREATE POLICY "Authenticated users can view visible posts"
ON public.forum_posts
FOR SELECT
TO authenticated
USING (
  (is_hidden = false)
  AND ((organization_id = get_user_organization_id()) OR (organization_id IS NULL))
  AND (
    audience = 'all'
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'moderator'::app_role)
    OR is_super_admin()
  )
);

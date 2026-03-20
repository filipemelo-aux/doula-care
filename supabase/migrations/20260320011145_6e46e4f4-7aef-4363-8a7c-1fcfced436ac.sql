DROP POLICY "Authenticated users can view visible posts" ON public.forum_posts;

CREATE POLICY "Authenticated users can view visible posts" ON public.forum_posts
FOR SELECT TO authenticated
USING (
  (is_hidden = false)
  AND ((organization_id = get_user_organization_id()) OR (organization_id IS NULL))
  AND (
    audience = 'all'
    OR (audience = 'doulas_only' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR is_super_admin()))
    OR (audience = 'gestantes_only' AND (has_role(auth.uid(), 'client') OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR is_super_admin()))
  )
);
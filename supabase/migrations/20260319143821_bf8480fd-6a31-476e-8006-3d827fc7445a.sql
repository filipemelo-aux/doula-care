-- Fix profile INSERT: prevent users from setting organization_id directly
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND organization_id IS NULL
);

-- Fix forum_reactions INSERT: verify post visibility
DROP POLICY IF EXISTS "Users can add reactions" ON public.forum_reactions;

CREATE POLICY "Users can add reactions"
ON public.forum_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    post_id IS NULL
    OR EXISTS (
      SELECT 1 FROM forum_posts fp
      WHERE fp.id = forum_reactions.post_id
        AND fp.is_hidden = false
        AND (fp.organization_id = get_user_organization_id() OR fp.organization_id IS NULL)
    )
  )
  AND (
    comment_id IS NULL
    OR EXISTS (
      SELECT 1 FROM forum_comments fc
      JOIN forum_posts fp ON fp.id = fc.post_id
      WHERE fc.id = forum_reactions.comment_id
        AND fc.is_hidden = false
        AND fp.is_hidden = false
        AND (fp.organization_id = get_user_organization_id() OR fp.organization_id IS NULL)
    )
  )
);
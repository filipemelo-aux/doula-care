
-- Forum categories (predefined topics)
CREATE TABLE public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT '💬',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active categories"
  ON public.forum_categories FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins can manage categories"
  ON public.forum_categories FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Forum posts
CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  is_anonymous boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  content text NOT NULL
);

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view visible posts"
  ON public.forum_posts FOR SELECT TO authenticated
  USING (is_hidden = false);

CREATE POLICY "Authenticated users can create posts"
  ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own posts"
  ON public.forum_posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete own posts"
  ON public.forum_posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Admins can moderate posts"
  ON public.forum_posts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR is_super_admin());

CREATE POLICY "Admins can delete posts"
  ON public.forum_posts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR is_super_admin());

CREATE POLICY "Super admins can manage all posts"
  ON public.forum_posts FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Forum comments
CREATE TABLE public.forum_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_anonymous boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL
);

ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view visible comments"
  ON public.forum_comments FOR SELECT TO authenticated
  USING (is_hidden = false);

CREATE POLICY "Authenticated users can create comments"
  ON public.forum_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update own comments"
  ON public.forum_comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete own comments"
  ON public.forum_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Admins can moderate comments"
  ON public.forum_comments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR is_super_admin());

CREATE POLICY "Admins can delete comments"
  ON public.forum_comments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator') OR is_super_admin());

-- Forum reactions (likes)
CREATE TABLE public.forum_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL DEFAULT '❤️',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, reaction_type),
  UNIQUE(comment_id, user_id, reaction_type)
);

ALTER TABLE public.forum_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reactions"
  ON public.forum_reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can add reactions"
  ON public.forum_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.forum_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_forum_posts_category ON public.forum_posts(category_id);
CREATE INDEX idx_forum_posts_author ON public.forum_posts(author_id);
CREATE INDEX idx_forum_posts_created ON public.forum_posts(created_at DESC);
CREATE INDEX idx_forum_comments_post ON public.forum_comments(post_id);
CREATE INDEX idx_forum_reactions_post ON public.forum_reactions(post_id);
CREATE INDEX idx_forum_reactions_comment ON public.forum_reactions(comment_id);

-- Insert default categories
INSERT INTO public.forum_categories (name, description, icon, sort_order) VALUES
  ('Gestação', 'Dúvidas e experiências sobre a gestação', '🤰', 1),
  ('Parto', 'Tipos de parto, preparação e relatos', '👶', 2),
  ('Amamentação', 'Dicas e apoio sobre amamentação', '🤱', 3),
  ('Pós-parto', 'Recuperação, saúde mental e cuidados', '💜', 4),
  ('Bebê', 'Cuidados com o recém-nascido', '🍼', 5),
  ('Bem-estar', 'Autocuidado, exercícios e alimentação', '🧘‍♀️', 6),
  ('Livre', 'Conversas livres entre a comunidade', '💬', 7);

-- Enable realtime for posts and comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.forum_comments;

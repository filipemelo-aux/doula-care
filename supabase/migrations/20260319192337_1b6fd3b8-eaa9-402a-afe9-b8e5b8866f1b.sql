
CREATE TABLE public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read system_config"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (true);

-- Only super_admin can update
CREATE POLICY "Super admin can update system_config"
  ON public.system_config FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Insert initial force_update_at value
INSERT INTO public.system_config (key, value) VALUES ('force_update_at', '2000-01-01T00:00:00Z');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config;

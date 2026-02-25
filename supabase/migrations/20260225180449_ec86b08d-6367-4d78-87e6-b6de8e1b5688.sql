
CREATE TABLE public.platform_plan_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan text NOT NULL UNIQUE,
  max_clients integer, -- null = unlimited
  reports boolean NOT NULL DEFAULT false,
  export_reports boolean NOT NULL DEFAULT false,
  push_notifications boolean NOT NULL DEFAULT true,
  multi_collaborators boolean NOT NULL DEFAULT false,
  max_collaborators integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view plan limits"
  ON public.platform_plan_limits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage plan limits"
  ON public.platform_plan_limits FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Seed default values
INSERT INTO public.platform_plan_limits (plan, max_clients, reports, export_reports, push_notifications, multi_collaborators, max_collaborators)
VALUES
  ('free', 5, false, false, true, false, 1),
  ('pro', null, true, true, true, false, 1),
  ('premium', null, true, true, true, true, 5);

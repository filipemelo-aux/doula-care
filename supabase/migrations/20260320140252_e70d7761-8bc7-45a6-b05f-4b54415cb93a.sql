
-- Table to track organization access/logins
CREATE TABLE public.org_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast querying by org and date
CREATE INDEX idx_org_access_log_org_date ON public.org_access_log (organization_id, accessed_at DESC);

-- Enable RLS
ALTER TABLE public.org_access_log ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert their own access log
CREATE POLICY "Users can insert own access log"
  ON public.org_access_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Super admins can read all access logs
CREATE POLICY "Super admins can read all access logs"
  ON public.org_access_log FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Admins can read own org access logs
CREATE POLICY "Admins can read own org access logs"
  ON public.org_access_log FOR SELECT
  TO authenticated
  USING (
    (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
    AND organization_id = get_user_organization_id()
  );

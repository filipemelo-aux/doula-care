CREATE TABLE public.followup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  performed_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followup_sessions TO authenticated;
GRANT ALL ON public.followup_sessions TO service_role;
ALTER TABLE public.followup_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org admins manage followup sessions" ON public.followup_sessions FOR ALL TO authenticated
USING (organization_id = public.get_user_organization_id() AND (public.has_role(auth.uid(),'admin') OR public.is_super_admin()))
WITH CHECK (organization_id = public.get_user_organization_id() AND (public.has_role(auth.uid(),'admin') OR public.is_super_admin()));
CREATE INDEX idx_followup_sessions_client ON public.followup_sessions(client_id);
CREATE TRIGGER update_followup_sessions_updated_at BEFORE UPDATE ON public.followup_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
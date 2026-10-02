CREATE TABLE public.team_member_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  allowed_paths text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_member_permissions TO authenticated;
GRANT ALL ON public.team_member_permissions TO service_role;
ALTER TABLE public.team_member_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own permissions" ON public.team_member_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Org admins manage permissions" ON public.team_member_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id())
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_organization_id());
CREATE TRIGGER trg_team_member_permissions_updated BEFORE UPDATE ON public.team_member_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
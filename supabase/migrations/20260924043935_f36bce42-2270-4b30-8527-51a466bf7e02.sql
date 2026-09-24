CREATE TABLE public.plan_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_setting_id uuid NOT NULL REFERENCES public.plan_settings(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  modality text NOT NULL DEFAULT 'presencial',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_consultations TO authenticated;
GRANT ALL ON public.plan_consultations TO service_role;
ALTER TABLE public.plan_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org admins manage plan consultations" ON public.plan_consultations FOR ALL TO authenticated
USING (organization_id = public.get_user_organization_id() AND (public.has_role(auth.uid(),'admin') OR public.is_super_admin()))
WITH CHECK (organization_id = public.get_user_organization_id() AND (public.has_role(auth.uid(),'admin') OR public.is_super_admin()));
CREATE INDEX idx_plan_consultations_plan ON public.plan_consultations(plan_setting_id);
CREATE TRIGGER update_plan_consultations_updated_at BEFORE UPDATE ON public.plan_consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.followup_sessions
  ADD COLUMN sequence integer,
  ADD COLUMN appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'done',
  ALTER COLUMN performed_at DROP NOT NULL,
  ALTER COLUMN performed_at DROP DEFAULT;
CREATE UNIQUE INDEX uq_followup_sessions_client_seq ON public.followup_sessions(client_id, sequence) WHERE sequence IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_followup_session_from_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.followup_sessions WHERE appointment_id = OLD.id AND status = 'scheduled';
    RETURN OLD;
  END IF;
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    UPDATE public.followup_sessions SET status = 'done',
      performed_at = (NEW.completed_at AT TIME ZONE 'America/Sao_Paulo')::date,
      notes = COALESCE(NEW.completion_notes, notes)
    WHERE appointment_id = NEW.id;
  ELSIF NEW.completed_at IS NULL AND OLD.completed_at IS NOT NULL THEN
    UPDATE public.followup_sessions SET status = 'scheduled', performed_at = NULL WHERE appointment_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_followup_session_from_appointment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_appointment_followup_update AFTER UPDATE OF completed_at ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_followup_session_from_appointment();
CREATE TRIGGER trg_appointment_followup_delete BEFORE DELETE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_followup_session_from_appointment();
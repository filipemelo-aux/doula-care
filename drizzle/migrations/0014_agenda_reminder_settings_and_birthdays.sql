ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'regular';

CREATE TABLE public.agenda_reminder_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  doula_offsets_minutes integer[] NOT NULL DEFAULT '{1440,60}',
  client_offsets_minutes integer[] NOT NULL DEFAULT '{1440,60}',
  doula_reminders_enabled boolean NOT NULL DEFAULT true,
  client_reminders_enabled boolean NOT NULL DEFAULT true,
  personal_reminders_enabled boolean NOT NULL DEFAULT true,
  notify_client_on_new_appointment boolean NOT NULL DEFAULT true,
  notify_on_appointment_request boolean NOT NULL DEFAULT true,
  birthday_enabled boolean NOT NULL DEFAULT true,
  birthday_advance_days integer[] NOT NULL DEFAULT '{7,0}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.agenda_reminder_settings TO authenticated;
GRANT ALL ON public.agenda_reminder_settings TO service_role;
ALTER TABLE public.agenda_reminder_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org staff read reminder settings" ON public.agenda_reminder_settings FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')));
CREATE POLICY "Org admin insert reminder settings" ON public.agenda_reminder_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Org admin update reminder settings" ON public.agenda_reminder_settings FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER update_agenda_reminder_settings_updated_at BEFORE UPDATE ON public.agenda_reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.appointment_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  audience text NOT NULL,
  offset_minutes integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, audience, offset_minutes)
);
GRANT ALL ON public.appointment_reminder_log TO service_role;
ALTER TABLE public.appointment_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sync_baby_birthday_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_when timestamptz;
  v_names text;
BEGIN
  IF NEW.birth_occurred IS NOT TRUE OR NEW.birth_date IS NULL OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.birth_occurred IS TRUE AND OLD.birth_date IS NOT DISTINCT FROM NEW.birth_date
     AND OLD.baby_names IS NOT DISTINCT FROM NEW.baby_names THEN
    RETURN NEW;
  END IF;
  v_when := ((NEW.birth_date + interval '1 year')::date + time '09:00') AT TIME ZONE 'America/Sao_Paulo';
  v_names := NULLIF(array_to_string(NEW.baby_names, ' e '), '');
  UPDATE public.appointments
     SET scheduled_at = v_when,
         title = '🎂 1 aninho de ' || COALESCE(v_names, 'bebê de ' || NEW.full_name)
   WHERE client_id = NEW.id AND kind = 'birthday' AND completed_at IS NULL;
  IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.appointments WHERE client_id = NEW.id AND kind = 'birthday') THEN
    INSERT INTO public.appointments (client_id, organization_id, owner_id, title, scheduled_at, notes, kind)
    VALUES (NEW.id, NEW.organization_id, NEW.owner_id,
      '🎂 1 aninho de ' || COALESCE(v_names, 'bebê de ' || NEW.full_name), v_when,
      'Lembrete automático: o bebê de ' || NEW.full_name || ' completa 1 ano.', 'birthday');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_baby_birthday_appointment AFTER INSERT OR UPDATE OF birth_occurred, birth_date, baby_names ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_baby_birthday_appointment();

INSERT INTO public.appointments (client_id, organization_id, owner_id, title, scheduled_at, notes, kind)
SELECT c.id, c.organization_id, c.owner_id,
  '🎂 1 aninho de ' || COALESCE(NULLIF(array_to_string(c.baby_names, ' e '), ''), 'bebê de ' || c.full_name),
  ((c.birth_date + interval '1 year')::date + time '09:00') AT TIME ZONE 'America/Sao_Paulo',
  'Lembrete automático: o bebê de ' || c.full_name || ' completa 1 ano.', 'birthday'
FROM public.clients c
WHERE c.birth_occurred IS TRUE AND c.birth_date IS NOT NULL AND c.organization_id IS NOT NULL
  AND (c.birth_date + interval '1 year') >= current_date
  AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.client_id = c.id AND a.kind = 'birthday');
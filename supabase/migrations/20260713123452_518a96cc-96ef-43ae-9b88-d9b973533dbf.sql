
-- Calendar labels (definitions per organization)
CREATE TABLE public.calendar_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#EF4444',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calendar_labels_org ON public.calendar_labels(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_labels TO authenticated;
GRANT ALL ON public.calendar_labels TO service_role;
ALTER TABLE public.calendar_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage calendar labels"
ON public.calendar_labels FOR ALL
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
);

CREATE TRIGGER trg_calendar_labels_updated
  BEFORE UPDATE ON public.calendar_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Day → label assignments (a date can have multiple labels)
CREATE TABLE public.calendar_day_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  label_id UUID NOT NULL REFERENCES public.calendar_labels(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, day, label_id)
);
CREATE INDEX idx_calendar_day_labels_org_day ON public.calendar_day_labels(organization_id, day);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_day_labels TO authenticated;
GRANT ALL ON public.calendar_day_labels TO service_role;
ALTER TABLE public.calendar_day_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage day labels"
ON public.calendar_day_labels FOR ALL
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
);

CREATE TRIGGER trg_calendar_day_labels_updated
  BEFORE UPDATE ON public.calendar_day_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

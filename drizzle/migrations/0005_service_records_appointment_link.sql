ALTER TABLE public.service_records
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

UPDATE public.service_records sr SET appointment_id = a.id
FROM public.appointments a
WHERE sr.appointment_id IS NULL
  AND a.client_id IS NOT DISTINCT FROM sr.client_id
  AND a.title = sr.service_name
  AND (a.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = sr.service_date;

UPDATE public.service_records sr SET completed_at = a.completed_at
FROM public.appointments a WHERE a.id = sr.appointment_id AND sr.completed_at IS NULL;
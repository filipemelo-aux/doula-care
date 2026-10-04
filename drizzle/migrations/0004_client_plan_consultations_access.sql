ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS consultation_sequence integer,
  ADD COLUMN IF NOT EXISTS consultation_name text;

CREATE POLICY "Clients view own linked plan"
ON public.plan_settings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.plan_setting_id = plan_settings.id AND c.user_id = auth.uid()));

CREATE POLICY "Clients view own followup sessions"
ON public.followup_sessions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = followup_sessions.client_id AND c.user_id = auth.uid()));

GRANT SELECT ON public.followup_sessions TO authenticated;
GRANT SELECT ON public.plan_settings TO authenticated;
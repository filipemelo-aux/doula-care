
-- Doula availability: stores available days with time slots
CREATE TABLE public.doula_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  available_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, available_date, start_time)
);

ALTER TABLE public.doula_availability ENABLE ROW LEVEL SECURITY;

-- Admins can manage their org availability
CREATE POLICY "Admins can manage org availability"
ON public.doula_availability FOR ALL
TO authenticated
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')) AND organization_id = get_user_organization_id())
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')) AND organization_id = get_user_organization_id());

-- Clients can view their org availability
CREATE POLICY "Clients can view org availability"
ON public.doula_availability FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM clients c WHERE c.user_id = auth.uid() AND c.organization_id = doula_availability.organization_id
));

-- Super admins
CREATE POLICY "Super admins can manage all availability"
ON public.doula_availability FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

-- Appointment requests from clients
CREATE TABLE public.appointment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_date date NOT NULL,
  requested_time time NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

-- Trigger for org_id auto-fill
CREATE TRIGGER auto_fill_org_appointment_requests
  BEFORE INSERT ON public.appointment_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_organization_id_from_client();

-- Admins can manage org appointment requests
CREATE POLICY "Admins can manage org appointment requests"
ON public.appointment_requests FOR ALL
TO authenticated
USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')) AND organization_id = get_user_organization_id())
WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')) AND organization_id = get_user_organization_id());

-- Clients can insert own requests
CREATE POLICY "Clients can insert own appointment requests"
ON public.appointment_requests FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM clients c WHERE c.id = appointment_requests.client_id AND c.user_id = auth.uid()));

-- Clients can view own requests
CREATE POLICY "Clients can view own appointment requests"
ON public.appointment_requests FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM clients c WHERE c.id = appointment_requests.client_id AND c.user_id = auth.uid()));

-- Super admins
CREATE POLICY "Super admins can manage all appointment requests"
ON public.appointment_requests FOR ALL
TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

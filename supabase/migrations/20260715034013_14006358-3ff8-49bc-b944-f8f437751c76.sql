
CREATE TABLE public.moderator_payment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  client_id UUID NOT NULL,
  moderator_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

CREATE INDEX idx_mpr_org_status ON public.moderator_payment_requests(organization_id, status);
CREATE INDEX idx_mpr_moderator ON public.moderator_payment_requests(moderator_id);

GRANT SELECT, INSERT, UPDATE ON public.moderator_payment_requests TO authenticated;
GRANT ALL ON public.moderator_payment_requests TO service_role;

ALTER TABLE public.moderator_payment_requests ENABLE ROW LEVEL SECURITY;

-- Moderator can insert own requests for own org
CREATE POLICY "Moderator can create own payment requests"
ON public.moderator_payment_requests FOR INSERT
TO authenticated
WITH CHECK (
  moderator_id = auth.uid()
  AND organization_id = public.get_user_organization_id()
  AND public.has_role(auth.uid(), 'moderator'::app_role)
);

-- Moderator can see own requests; admin/moderator can see org requests
CREATE POLICY "Org team can view payment requests"
ON public.moderator_payment_requests FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  )
);

-- Admin can update (approve/cancel) requests of own org
CREATE POLICY "Admin can update payment requests"
ON public.moderator_payment_requests FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  organization_id = public.get_user_organization_id()
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

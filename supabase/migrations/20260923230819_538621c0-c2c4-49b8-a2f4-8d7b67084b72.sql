CREATE TABLE public.service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  service_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'forecast' CHECK (status IN ('forecast','invoiced')),
  transaction_id uuid UNIQUE REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_records TO authenticated;
GRANT ALL ON public.service_records TO service_role;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org admins manage service records" ON public.service_records
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Super admins read service records" ON public.service_records
  FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE TRIGGER update_service_records_updated_at BEFORE UPDATE ON public.service_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.service_records (organization_id, client_id, service_date, service_name, amount, notes, status, transaction_id, created_at)
SELECT t.organization_id, t.client_id, t.date, t.description, t.amount, t.notes, 'invoiced', t.id, t.created_at
FROM public.transactions t
WHERE t.type = 'receita'
  AND NOT (COALESCE(t.is_auto_generated,false) = true AND (t.plan_id IS NOT NULL OR t.description LIKE 'Contrato%'));
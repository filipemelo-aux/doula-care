
-- Table for platform plan pricing (managed by super admin)
CREATE TABLE public.platform_plan_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan text NOT NULL CHECK (plan IN ('pro', 'premium')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (plan, billing_cycle)
);

-- Enable RLS
ALTER TABLE public.platform_plan_pricing ENABLE ROW LEVEL SECURITY;

-- Super admins can manage pricing
CREATE POLICY "Super admins can manage platform pricing"
  ON public.platform_plan_pricing FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Anyone authenticated can read active pricing
CREATE POLICY "Authenticated users can view active pricing"
  ON public.platform_plan_pricing FOR SELECT
  USING (is_active = true);

-- Seed default pricing
INSERT INTO public.platform_plan_pricing (plan, billing_cycle, price) VALUES
  ('pro', 'monthly', 0),
  ('pro', 'annual', 0),
  ('premium', 'monthly', 0),
  ('premium', 'annual', 0);

-- Table for org billing records (manual payments tracking)
CREATE TABLE public.org_billing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  reference_month date NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  paid_at timestamp with time zone,
  payment_method text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.org_billing ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all billing
CREATE POLICY "Super admins can manage all billing"
  ON public.org_billing FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Orgs can view own billing
CREATE POLICY "Orgs can view own billing"
  ON public.org_billing FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Add billing_cycle and stripe fields to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS next_billing_date date;

-- Updated_at trigger for new tables
CREATE TRIGGER update_platform_plan_pricing_updated_at
  BEFORE UPDATE ON public.platform_plan_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_billing_updated_at
  BEFORE UPDATE ON public.org_billing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

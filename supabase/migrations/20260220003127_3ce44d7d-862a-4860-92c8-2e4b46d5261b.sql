
-- Create payments table for granular installment tracking
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  installment_number INTEGER NOT NULL DEFAULT 1,
  total_installments INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC NOT NULL,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'parcial', 'pago', 'atrasado')),
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins and moderators can manage all payments"
ON public.payments FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Clients can view own payments"
ON public.payments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM clients c WHERE c.id = payments.client_id AND c.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-calculate payment status
CREATE OR REPLACE FUNCTION public.update_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount_paid >= NEW.amount THEN
    NEW.status := 'pago';
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
  ELSIF NEW.amount_paid > 0 AND NEW.amount_paid < NEW.amount THEN
    NEW.status := 'parcial';
  ELSE
    NEW.status := 'pendente';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_update_payment_status
BEFORE INSERT OR UPDATE OF amount_paid ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_status();

-- Add owner_id to main tables for future multi-tenant support
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.payments ADD COLUMN owner_id UUID;
ALTER TABLE public.plan_settings ADD COLUMN IF NOT EXISTS owner_id UUID;


-- Create client_contracts table
CREATE TABLE public.client_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  title TEXT NOT NULL DEFAULT 'Contrato de Prestação de Serviços',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed')),
  signature_data TEXT, -- base64 of drawn signature or typed name
  signature_type TEXT CHECK (signature_type IN ('drawn', 'typed')),
  signed_at TIMESTAMP WITH TIME ZONE,
  signer_name TEXT,
  signer_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

-- Admins can manage org contracts
CREATE POLICY "Admins can manage org contracts"
  ON public.client_contracts
  FOR ALL
  USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    AND organization_id = get_user_organization_id()
  )
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
    AND organization_id = get_user_organization_id()
  );

-- Clients can view own contracts
CREATE POLICY "Clients can view own contracts"
  ON public.client_contracts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_contracts.client_id AND c.user_id = auth.uid()
    )
  );

-- Clients can update own contracts (to sign)
CREATE POLICY "Clients can sign own contracts"
  ON public.client_contracts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_contracts.client_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_contracts.client_id AND c.user_id = auth.uid()
    )
  );

-- Super admins can manage all
CREATE POLICY "Super admins can manage all contracts"
  ON public.client_contracts
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Trigger for updated_at
CREATE TRIGGER update_client_contracts_updated_at
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =============================================
-- FASE 1A: Estrutura base + migration de dados
-- =============================================

-- 1) Enum para planos e status de organization
CREATE TYPE public.org_plan AS ENUM ('free', 'pro', 'premium');
CREATE TYPE public.org_status AS ENUM ('ativo', 'suspenso');

-- 2) Tabela organizations
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  responsible_email TEXT NOT NULL,
  plan org_plan NOT NULL DEFAULT 'free',
  status org_status NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Adicionar organization_id em todas as tabelas core
ALTER TABLE public.clients ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.transactions ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.payments ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.appointments ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.pregnancy_diary ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.client_notifications ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.contractions ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.service_requests ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.plan_settings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.admin_settings ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- 4) Adicionar role super_admin ao enum existente
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 5) Helper function: get organization_id do user autenticado
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.organization_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

-- 6) Indexes for performance
CREATE INDEX idx_clients_organization_id ON public.clients(organization_id);
CREATE INDEX idx_transactions_organization_id ON public.transactions(organization_id);
CREATE INDEX idx_payments_organization_id ON public.payments(organization_id);
CREATE INDEX idx_appointments_organization_id ON public.appointments(organization_id);
CREATE INDEX idx_pregnancy_diary_organization_id ON public.pregnancy_diary(organization_id);
CREATE INDEX idx_client_notifications_organization_id ON public.client_notifications(organization_id);
CREATE INDEX idx_contractions_organization_id ON public.contractions(organization_id);
CREATE INDEX idx_service_requests_organization_id ON public.service_requests(organization_id);
CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);

-- 7) Migrar dados existentes
DO $$
DECLARE
  rec RECORD;
  new_org_id UUID;
  owner_name TEXT;
BEGIN
  FOR rec IN
    SELECT DISTINCT owner_id FROM public.clients WHERE owner_id IS NOT NULL
  LOOP
    SELECT full_name INTO owner_name FROM public.profiles WHERE user_id = rec.owner_id LIMIT 1;
    
    new_org_id := gen_random_uuid();
    
    INSERT INTO public.organizations (id, name, responsible_email, plan, status)
    VALUES (new_org_id, COALESCE(owner_name, 'Doula'), rec.owner_id::text || '@migrated.local', 'pro', 'ativo');
    
    UPDATE public.clients SET organization_id = new_org_id WHERE owner_id = rec.owner_id;
    UPDATE public.transactions SET organization_id = new_org_id WHERE owner_id = rec.owner_id;
    UPDATE public.payments SET organization_id = new_org_id WHERE owner_id = rec.owner_id;
    UPDATE public.appointments SET organization_id = new_org_id WHERE owner_id = rec.owner_id;
    UPDATE public.plan_settings SET organization_id = new_org_id WHERE owner_id = rec.owner_id;
    UPDATE public.admin_settings SET organization_id = new_org_id WHERE owner_id = rec.owner_id;
    UPDATE public.profiles SET organization_id = new_org_id WHERE user_id = rec.owner_id;
    
    UPDATE public.pregnancy_diary pd SET organization_id = new_org_id
    FROM public.clients c WHERE c.id = pd.client_id AND c.owner_id = rec.owner_id;
    
    UPDATE public.client_notifications cn SET organization_id = new_org_id
    FROM public.clients c WHERE c.id = cn.client_id AND c.owner_id = rec.owner_id;
    
    UPDATE public.contractions co SET organization_id = new_org_id
    FROM public.clients c WHERE c.id = co.client_id AND c.owner_id = rec.owner_id;
    
    UPDATE public.service_requests sr SET organization_id = new_org_id
    FROM public.clients c WHERE c.id = sr.client_id AND c.owner_id = rec.owner_id;
    
    -- Client user profiles
    UPDATE public.profiles p SET organization_id = new_org_id
    FROM public.clients c WHERE c.user_id = p.user_id AND c.owner_id = rec.owner_id
    AND p.organization_id IS NULL;
  END LOOP;
END;
$$;

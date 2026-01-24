-- Enum para situação da cliente
CREATE TYPE public.client_status AS ENUM ('tentante', 'gestante', 'lactante');

-- Enum para planos
CREATE TYPE public.plan_type AS ENUM ('basico', 'intermediario', 'completo');

-- Enum para forma de pagamento
CREATE TYPE public.payment_method AS ENUM ('pix', 'cartao', 'dinheiro', 'transferencia');

-- Enum para status do pagamento
CREATE TYPE public.payment_status AS ENUM ('pendente', 'pago', 'parcial');

-- Enum para tipo de transação financeira
CREATE TYPE public.transaction_type AS ENUM ('receita', 'despesa');

-- Enum para categoria de despesa
CREATE TYPE public.expense_category AS ENUM ('materiais', 'transporte', 'marketing', 'formacao', 'equipamentos', 'outros');

-- Tabela de clientes
CREATE TABLE public.clients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Dados Pessoais
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    cpf TEXT,
    street TEXT,
    number TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    -- Dados do Acompanhante
    companion_name TEXT,
    companion_phone TEXT,
    -- Perfil Materno
    status client_status NOT NULL DEFAULT 'gestante',
    pregnancy_weeks INTEGER,
    -- Dados do Plano
    plan plan_type NOT NULL DEFAULT 'basico',
    payment_method payment_method NOT NULL DEFAULT 'pix',
    payment_status payment_status NOT NULL DEFAULT 'pendente',
    plan_value DECIMAL(10,2) DEFAULT 0,
    -- Metadados
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações financeiras
CREATE TABLE public.transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type transaction_type NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    expense_category expense_category,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações dos planos
CREATE TABLE public.plan_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_type plan_type NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    default_value DECIMAL(10,2) NOT NULL DEFAULT 0,
    features TEXT[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configurações padrão dos planos
INSERT INTO public.plan_settings (plan_type, name, description, default_value, features) VALUES
('basico', 'Plano Básico', 'Acompanhamento essencial para gestantes', 800.00, ARRAY['Consultas mensais', 'Suporte via WhatsApp', 'Material educativo']),
('intermediario', 'Plano Intermediário', 'Acompanhamento completo com suporte estendido', 1500.00, ARRAY['Consultas quinzenais', 'Suporte 24h via WhatsApp', 'Material educativo', 'Visita pós-parto']),
('completo', 'Plano Completo', 'Acompanhamento premium com todos os serviços', 2500.00, ARRAY['Consultas semanais', 'Suporte 24h via WhatsApp', 'Material educativo', 'Acompanhamento no parto', 'Visitas pós-parto', 'Suporte à amamentação']);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_settings ENABLE ROW LEVEL SECURITY;

-- Políticas públicas (para o dashboard administrativo sem auth inicial)
-- Nota: Em produção, adicionar autenticação e restringir acesso
CREATE POLICY "Allow all access to clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to plan_settings" ON public.plan_settings FOR ALL USING (true) WITH CHECK (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_settings_updated_at
    BEFORE UPDATE ON public.plan_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
-- Adicionar status ativo/inativo aos planos
ALTER TABLE public.plan_settings ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Criar enum para tipo de despesa
CREATE TYPE public.expense_type AS ENUM ('material_trabalho', 'servicos_contratados');

-- Atualizar enum de categoria de despesa com novas opções
-- Primeiro criar o novo enum
CREATE TYPE public.expense_category_new AS ENUM (
  'social_media', 
  'filmmaker', 
  'marketing', 
  'material_hospitalar', 
  'material_escritorio',
  'transporte', 
  'formacao', 
  'equipamentos',
  'servicos_terceiros',
  'outros'
);

-- Adicionar coluna temporária
ALTER TABLE public.transactions ADD COLUMN expense_category_temp expense_category_new;

-- Migrar dados existentes
UPDATE public.transactions SET expense_category_temp = 
  CASE expense_category::text
    WHEN 'materiais' THEN 'material_escritorio'::expense_category_new
    WHEN 'transporte' THEN 'transporte'::expense_category_new
    WHEN 'marketing' THEN 'marketing'::expense_category_new
    WHEN 'formacao' THEN 'formacao'::expense_category_new
    WHEN 'equipamentos' THEN 'equipamentos'::expense_category_new
    WHEN 'outros' THEN 'outros'::expense_category_new
    ELSE 'outros'::expense_category_new
  END
WHERE expense_category IS NOT NULL;

-- Remover coluna antiga e renomear nova
ALTER TABLE public.transactions DROP COLUMN expense_category;
ALTER TABLE public.transactions RENAME COLUMN expense_category_temp TO expense_category;

-- Remover enum antigo
DROP TYPE public.expense_category;

-- Renomear novo enum
ALTER TYPE public.expense_category_new RENAME TO expense_category;

-- Adicionar tipo de despesa à tabela de transações
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS expense_type expense_type;

-- Adicionar forma de pagamento às transações (para despesas)
CREATE TYPE public.transaction_payment_method AS ENUM ('pix', 'cartao', 'dinheiro', 'transferencia', 'boleto');
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method transaction_payment_method DEFAULT 'pix';

-- Adicionar referência ao plano nas transações (para receitas automáticas)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plan_settings(id) ON DELETE SET NULL;

-- Adicionar campo para identificar se a receita foi gerada automaticamente
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false;
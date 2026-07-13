ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS religiao text,
  ADD COLUMN IF NOT EXISTS personalidade text;
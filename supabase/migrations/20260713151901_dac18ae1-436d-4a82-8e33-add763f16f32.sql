ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS has_pets boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pets_names text,
  ADD COLUMN IF NOT EXISTS partos_anteriores jsonb,
  ADD COLUMN IF NOT EXISTS filhos_cesarea jsonb;
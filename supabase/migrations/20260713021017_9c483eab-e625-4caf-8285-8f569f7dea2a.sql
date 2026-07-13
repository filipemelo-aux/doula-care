
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS historico_saude text,
  ADD COLUMN IF NOT EXISTS historico_saude_familiar text,
  ADD COLUMN IF NOT EXISTS tipo_sanguineo text,
  ADD COLUMN IF NOT EXISTS cirurgias_anteriores text,
  ADD COLUMN IF NOT EXISTS restricoes_alimentares text;

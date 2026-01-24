-- Add baby names field to clients table (array to support multiple babies)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS baby_names TEXT[] DEFAULT '{}'::TEXT[];
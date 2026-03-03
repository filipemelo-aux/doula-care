
-- Add birth_location column to clients table (hospital name or "domiciliar")
ALTER TABLE public.clients ADD COLUMN birth_location text DEFAULT NULL;

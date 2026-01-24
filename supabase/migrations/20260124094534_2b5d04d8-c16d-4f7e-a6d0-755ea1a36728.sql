-- Adjust birth_weight and birth_height columns to have more flexible precision
-- birth_weight: up to 99.999 kg (babies are typically 2-5 kg)
-- birth_height: up to 99.99 cm (babies are typically 45-55 cm)

ALTER TABLE public.clients
ALTER COLUMN birth_weight TYPE NUMERIC(6,3),
ALTER COLUMN birth_height TYPE NUMERIC(5,2);
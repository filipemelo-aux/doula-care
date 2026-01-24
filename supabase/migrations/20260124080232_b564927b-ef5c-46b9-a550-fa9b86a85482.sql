-- Add column for DPP (Data Prevista para o Parto)
ALTER TABLE public.clients 
ADD COLUMN dpp date DEFAULT NULL;
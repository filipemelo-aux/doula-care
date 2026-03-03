
ALTER TABLE public.clients
ADD COLUMN prenatal_type text,
ADD COLUMN prenatal_high_risk boolean DEFAULT false;

COMMENT ON COLUMN public.clients.prenatal_type IS 'Tipo de pré-natal: sus, plano, particular';
COMMENT ON COLUMN public.clients.prenatal_high_risk IS 'Se o pré-natal é de alto risco';

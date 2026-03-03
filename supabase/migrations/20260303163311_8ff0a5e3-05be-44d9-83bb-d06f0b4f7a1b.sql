ALTER TABLE public.clients
ADD COLUMN prenatal_team jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.clients.prenatal_team IS 'Equipe particular do pré-natal: [{name, role}]';
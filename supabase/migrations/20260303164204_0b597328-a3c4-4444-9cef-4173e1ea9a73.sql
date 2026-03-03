
ALTER TABLE public.clients
ADD COLUMN comorbidades text DEFAULT null,
ADD COLUMN alergias text DEFAULT null,
ADD COLUMN restricao_aromaterapia text DEFAULT null,
ADD COLUMN has_fotografa boolean DEFAULT false,
ADD COLUMN fotografa_name text DEFAULT null,
ADD COLUMN fotografa_phone text DEFAULT null,
ADD COLUMN instagram_gestante text DEFAULT null,
ADD COLUMN instagram_acompanhante text DEFAULT null;

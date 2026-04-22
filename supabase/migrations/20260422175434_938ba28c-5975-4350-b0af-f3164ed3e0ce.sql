ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS instagram text;

DROP FUNCTION IF EXISTS public.get_public_doulas();

CREATE FUNCTION public.get_public_doulas()
RETURNS TABLE(
  id uuid,
  name text,
  nome_exibicao text,
  logo_url text,
  bio text,
  city text,
  state text,
  neighborhood text,
  service_areas text[],
  latitude numeric,
  longitude numeric,
  primary_color text,
  secondary_color text,
  whatsapp text,
  instagram text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.id, o.name, o.nome_exibicao, o.logo_url, o.bio,
    o.city, o.state, o.neighborhood, o.service_areas,
    o.latitude, o.longitude, o.primary_color, o.secondary_color,
    o.whatsapp, o.instagram
  FROM public.organizations o
  WHERE o.status = 'ativo' AND o.accepts_new_clients = true;
$$;
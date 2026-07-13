ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS restricoes_assistencia jsonb DEFAULT NULL;

UPDATE public.clients
SET restricoes_assistencia = jsonb_build_object(
  'alergias', COALESCE(NULLIF(alergias, ''), '') ||
    CASE
      WHEN restricao_aromaterapia IS NOT NULL AND restricao_aromaterapia <> ''
      THEN E'\n\nRestrições em aromaterapia: ' || restricao_aromaterapia
      ELSE ''
    END,
  'restricoes', COALESCE(restricoes_alimentares, ''),
  'fobias_gatilhos', '',
  'condicoes_especiais', ''
)
WHERE restricoes_assistencia IS NULL
  AND (
    (alergias IS NOT NULL AND alergias <> '')
    OR (restricao_aromaterapia IS NOT NULL AND restricao_aromaterapia <> '')
    OR (restricoes_alimentares IS NOT NULL AND restricoes_alimentares <> '')
  );
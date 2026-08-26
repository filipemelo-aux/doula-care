-- 1. Boas-vindas da doula vira opt-in: novos perfis nascem com ela já vista.
--    Somente o fluxo de registro de doula marca welcome_seen = false explicitamente.
ALTER TABLE public.profiles ALTER COLUMN welcome_seen SET DEFAULT true;

-- 2. Limpeza: remove a boas-vindas de doula pendente de qualquer usuário
--    que NÃO seja admin (gestantes, visitantes, moderadores, super admins).
UPDATE public.profiles p
SET welcome_seen = true
WHERE p.welcome_seen = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
      AND ur.role = 'admin'
  );
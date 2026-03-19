-- Revert dual-role admin+super_admin behavior and block it permanently at the database level.

-- 1) Remove super_admin from any user who is also admin or moderator.
DELETE FROM public.user_roles ur
WHERE ur.role = 'super_admin'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles other
    WHERE other.user_id = ur.user_id
      AND other.role IN ('admin', 'moderator')
  );

-- 2) Prevent future dual-role assignments involving super_admin + org roles.
CREATE OR REPLACE FUNCTION public.prevent_dual_super_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin' AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.user_id
      AND ur.role IN ('admin', 'moderator')
      AND ur.id <> COALESCE(NEW.id, gen_random_uuid())
  ) THEN
    RAISE EXCEPTION 'Usuários admin/moderator não podem receber o papel super_admin';
  END IF;

  IF NEW.role IN ('admin', 'moderator') AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = NEW.user_id
      AND ur.role = 'super_admin'
      AND ur.id <> COALESCE(NEW.id, gen_random_uuid())
  ) THEN
    RAISE EXCEPTION 'Usuários super_admin não podem receber os papéis admin/moderator';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_dual_super_admin_roles_on_user_roles ON public.user_roles;
CREATE TRIGGER prevent_dual_super_admin_roles_on_user_roles
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_dual_super_admin_roles();
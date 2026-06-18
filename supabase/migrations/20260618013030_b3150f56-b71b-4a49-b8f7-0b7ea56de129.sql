
-- 1) Tighten user_roles INSERT/UPDATE: prevent privilege escalation
DROP POLICY IF EXISTS "Admins can insert org roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update org roles" ON public.user_roles;
DROP POLICY IF EXISTS "Moderators can insert org roles" ON public.user_roles;

-- Admins may only assign roles strictly below 'admin' (i.e. moderator/client),
-- never admin/super_admin. Forbid editing one's own role row.
CREATE POLICY "Admins can insert org roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
  AND user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Admins can update org roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
  AND user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.organization_id = get_user_organization_id()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role])
  AND user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.organization_id = get_user_organization_id()
  )
);

CREATE POLICY "Moderators can insert org roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'moderator'::app_role)
  AND role <> ALL (ARRAY['admin'::app_role, 'super_admin'::app_role, 'moderator'::app_role])
  AND user_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = user_roles.user_id
      AND p.organization_id = get_user_organization_id()
  )
);

-- 2) system_config: restrict broad read to allow-listed public keys only
DROP POLICY IF EXISTS "Anyone can read system_config" ON public.system_config;

CREATE POLICY "Authenticated can read public system_config keys"
ON public.system_config
FOR SELECT
TO authenticated
USING (
  key IN ('force_update_at')
  OR key LIKE 'platform_pix_%'
);

-- 3) Storage: org-logos must be scoped by org folder
DROP POLICY IF EXISTS "Admins can upload org logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update org logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete org logos" ON storage.objects;

CREATE POLICY "Admins can upload own org logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
);

CREATE POLICY "Admins can update own org logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
)
WITH CHECK (
  bucket_id = 'org-logos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
);

CREATE POLICY "Admins can delete own org logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
  AND (storage.foldername(name))[1] = get_user_organization_id()::text
);

-- 4) Storage: rating-photos delete/upload must be scoped to owner folder
DROP POLICY IF EXISTS "Clients can delete own rating photos" ON storage.objects;
DROP POLICY IF EXISTS "Clients can upload rating photos" ON storage.objects;

CREATE POLICY "Clients can upload own rating photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rating-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Clients can delete own rating photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rating-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5) Revoke EXECUTE on internal trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_payment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_client_update_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_dual_super_admin_roles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_org_id_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_org_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_client_payment_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_payment_rollups() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_payment_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_transaction_payment_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_fill_organization_id_from_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_client_payment_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_master_super_admin_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_forum_author_name(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_forum_author_profiles(uuid[]) FROM PUBLIC, anon;

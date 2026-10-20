ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS share_diary_with_doula boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.client_shares_diary(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce((select share_diary_with_doula from public.clients where id = _client_id), true)
$$;

CREATE OR REPLACE FUNCTION public.set_diary_sharing(_share boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  update public.clients set share_diary_with_doula = _share where user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.set_diary_sharing(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_diary_sharing(boolean) TO authenticated;

DROP POLICY IF EXISTS "Admins can manage org diary entries" ON public.pregnancy_diary;
CREATE POLICY "Admins can manage org diary entries" ON public.pregnancy_diary
FOR ALL TO authenticated
USING ((public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
  AND organization_id = public.get_user_organization_id()
  AND public.client_shares_diary(client_id))
WITH CHECK ((public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role))
  AND organization_id = public.get_user_organization_id());
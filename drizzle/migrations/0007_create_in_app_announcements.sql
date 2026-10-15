CREATE TABLE public.in_app_announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 broadcast_id uuid NOT NULL,
 user_id uuid NOT NULL,
 organization_id uuid,
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
 message text NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE (broadcast_id, user_id)
);
GRANT SELECT ON public.in_app_announcements TO authenticated;
GRANT UPDATE (read_at) ON public.in_app_announcements TO authenticated;
GRANT ALL ON public.in_app_announcements TO service_role;
ALTER TABLE public.in_app_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipients read own announcements" ON public.in_app_announcements FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Recipients acknowledge own announcements" ON public.in_app_announcements FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX in_app_announcements_unread_idx ON public.in_app_announcements (user_id, created_at) WHERE read_at IS NULL;
CREATE OR REPLACE FUNCTION public.send_in_app_announcement(p_title text, p_message text, p_audience text DEFAULT 'all', p_organization_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_broadcast_id uuid := gen_random_uuid(); v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
  RAISE EXCEPTION 'Somente o Super Admin pode enviar avisos' USING ERRCODE = '42501';
 END IF;
 IF p_audience IS NULL OR p_audience NOT IN ('all', 'admins', 'clients') THEN RAISE EXCEPTION 'Público inválido'; END IF;
 IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 100 OR p_message IS NULL OR length(btrim(p_message)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Preencha título e mensagem dentro dos limites'; END IF;
 INSERT INTO public.in_app_announcements (broadcast_id, user_id, organization_id, title, message)
 SELECT v_broadcast_id, recipients.user_id, recipients.organization_id, btrim(p_title), btrim(p_message)
 FROM (
  SELECT DISTINCT p.user_id, p.organization_id FROM public.profiles p
  WHERE p_audience IN ('all', 'admins') AND (p_organization_id IS NULL OR p.organization_id = p_organization_id)
   AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role IN ('admin', 'moderator'))
   AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'super_admin')
  UNION
  SELECT DISTINCT c.user_id, c.organization_id FROM public.clients c
  WHERE p_audience IN ('all', 'clients') AND c.user_id IS NOT NULL AND (p_organization_id IS NULL OR c.organization_id = p_organization_id)
   AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = c.user_id AND r.role = 'super_admin')
 ) recipients ON CONFLICT (broadcast_id, user_id) DO NOTHING;
 GET DIAGNOSTICS v_count = ROW_COUNT;
 RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.send_in_app_announcement(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_in_app_announcement(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_in_app_announcement(text, text, text, uuid) TO service_role;
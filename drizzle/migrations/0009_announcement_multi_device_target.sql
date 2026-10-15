CREATE OR REPLACE FUNCTION public.send_in_app_announcement(p_title text, p_message text, p_audience text, p_organization_id uuid, p_target_device text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
 v_broadcast_id uuid := gen_random_uuid();
 v_count integer;
 v_devices text[];
 v_store text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN RAISE EXCEPTION 'Somente o Super Admin pode enviar avisos' USING ERRCODE = '42501'; END IF;
 IF p_target_device IS NULL OR btrim(p_target_device) = '' THEN
  v_devices := ARRAY['all'];
 ELSE
  SELECT array_agg(lower(btrim(d))) INTO v_devices FROM unnest(string_to_array(btrim(p_target_device), ',')) d;
 END IF;
 IF v_devices IS NULL OR array_length(v_devices, 1) = 0 THEN v_devices := ARRAY['all']; END IF;
 IF EXISTS (SELECT 1 FROM unnest(v_devices) d WHERE d NOT IN ('all','browser','android','ios')) THEN RAISE EXCEPTION 'Dispositivo inválido'; END IF;
 IF 'all' = ANY(v_devices) THEN v_store := 'all'; ELSE v_store := array_to_string(v_devices, ','); END IF;
 IF p_audience IS NULL OR p_audience NOT IN ('all','admins','clients') THEN RAISE EXCEPTION 'Público inválido'; END IF;
 IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 100 OR p_message IS NULL OR length(btrim(p_message)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Preencha título e mensagem dentro dos limites'; END IF;
 INSERT INTO public.in_app_announcements (broadcast_id,user_id,organization_id,title,message,target_device)
 SELECT v_broadcast_id, recipients.user_id, recipients.organization_id, btrim(p_title), btrim(p_message), v_store
 FROM (
 SELECT DISTINCT p.user_id, p.organization_id FROM public.profiles p
 WHERE p_audience IN ('all','admins') AND (p_organization_id IS NULL OR p.organization_id=p_organization_id)
 AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role IN ('admin','moderator'))
 AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role='super_admin')
 UNION
 SELECT DISTINCT c.user_id,c.organization_id FROM public.clients c
 WHERE p_audience IN ('all','clients') AND c.user_id IS NOT NULL AND (p_organization_id IS NULL OR c.organization_id=p_organization_id)
 AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=c.user_id AND r.role='super_admin')
 ) recipients ON CONFLICT (broadcast_id,user_id) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count;
END;
$function$;

COMMENT ON FUNCTION public.send_in_app_announcement(text, text, text, uuid, text) IS 'p_target_device aceita um dispositivo único ou lista separada por vírgulas (browser,android,ios); "all" envia para todos.';
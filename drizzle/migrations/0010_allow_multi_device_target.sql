ALTER TABLE public.in_app_announcements DROP CONSTRAINT in_app_announcements_target_device_check;

ALTER TABLE public.in_app_announcements
  ADD CONSTRAINT in_app_announcements_target_device_check
  CHECK (target_device ~ '^(all|browser|android|ios)(,(all|browser|android|ios))*$');

COMMENT ON COLUMN public.in_app_announcements.target_device IS 'Dispositivo único ou lista separada por vírgulas (browser,android,ios); "all" envia para todos.';
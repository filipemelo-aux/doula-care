-- Restore super_admin role for filiperasmelo@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('cd799764-f4dc-4857-9e40-5e7356f1bbb2', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Restore profile for filiperasmelo@gmail.com
INSERT INTO public.profiles (user_id, full_name)
VALUES ('cd799764-f4dc-4857-9e40-5e7356f1bbb2', 'Filipe Silva Melo')
ON CONFLICT (user_id) DO NOTHING;
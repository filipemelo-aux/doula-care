-- Clean up orphan test@email.com user
DELETE FROM public.profiles WHERE user_id = 'c226589f-bd9a-4459-a7ec-9934bc2e2f86';
DELETE FROM auth.users WHERE id = 'c226589f-bd9a-4459-a7ec-9934bc2e2f86';
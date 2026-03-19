-- Delete plan_settings for the test org
DELETE FROM public.plan_settings WHERE organization_id = '4373b6b2-3b80-41a2-8ca7-04e2882b29c5';

-- Delete admin_settings for the test org
DELETE FROM public.admin_settings WHERE organization_id = '4373b6b2-3b80-41a2-8ca7-04e2882b29c5';

-- Delete user_roles for the test user
DELETE FROM public.user_roles WHERE user_id = '3c73e0f7-9826-4d10-aa31-506acd70c9a3';

-- Delete push_subscriptions for the test user
DELETE FROM public.push_subscriptions WHERE user_id = '3c73e0f7-9826-4d10-aa31-506acd70c9a3';

-- Delete profile for the test user
DELETE FROM public.profiles WHERE user_id = '3c73e0f7-9826-4d10-aa31-506acd70c9a3';

-- Delete the organization
DELETE FROM public.organizations WHERE id = '4373b6b2-3b80-41a2-8ca7-04e2882b29c5';
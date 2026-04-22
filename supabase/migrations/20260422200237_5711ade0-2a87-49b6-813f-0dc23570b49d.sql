-- Limpeza manual da cliente Antônia Jaquilene (Coletivo Ilê Dourado)
-- Cliente id: d00ef4d1-0227-498b-a115-27225010340b
-- User id: 826ef93a-3072-4682-9ec3-c4ce270e44cb

DELETE FROM public.contractions WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.pregnancy_diary WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.client_notifications WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.service_requests WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.appointments WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.appointment_requests WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.client_contracts WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.payments WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.transactions WHERE client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.doula_match_requests WHERE visitor_client_id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.user_roles WHERE user_id = '826ef93a-3072-4682-9ec3-c4ce270e44cb';
DELETE FROM public.push_subscriptions WHERE user_id = '826ef93a-3072-4682-9ec3-c4ce270e44cb';
DELETE FROM public.notification_seen WHERE user_id = '826ef93a-3072-4682-9ec3-c4ce270e44cb';
DELETE FROM public.clients WHERE id = 'd00ef4d1-0227-498b-a115-27225010340b';
DELETE FROM public.profiles WHERE user_id = '826ef93a-3072-4682-9ec3-c4ce270e44cb';
DELETE FROM auth.users WHERE id = '826ef93a-3072-4682-9ec3-c4ce270e44cb';
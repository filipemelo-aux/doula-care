-- Enable realtime for client_notifications so we can listen for new inserts
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_notifications;
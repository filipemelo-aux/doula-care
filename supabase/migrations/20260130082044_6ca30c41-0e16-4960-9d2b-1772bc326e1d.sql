-- Add read_by_client column to client_notifications table
-- This separates client read state from admin read state
ALTER TABLE public.client_notifications
ADD COLUMN read_by_client BOOLEAN DEFAULT FALSE;

-- Comment explaining the distinction
COMMENT ON COLUMN public.client_notifications.read_by_client IS 'Tracks if the client has read this notification. Separate from "read" which is used by admin.';
-- Restore Isabella Alves Farinazzo Ferreira's preferred_name that was overwritten
-- with the moderator's name ("Andreia") due to a shared-session first-login flow.
UPDATE public.clients
   SET preferred_name = NULL
 WHERE id = '7f785cc0-ceaf-416c-85ec-79b348c91ddb'
   AND preferred_name = 'Andreia';
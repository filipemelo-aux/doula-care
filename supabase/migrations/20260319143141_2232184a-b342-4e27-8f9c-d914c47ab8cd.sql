CREATE OR REPLACE FUNCTION public.restrict_client_update_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF has_role(auth.uid(), 'client'::app_role) THEN
    NEW.payment_status := OLD.payment_status;
    NEW.plan := OLD.plan;
    NEW.plan_value := OLD.plan_value;
    NEW.plan_setting_id := OLD.plan_setting_id;
    NEW.organization_id := OLD.organization_id;
    NEW.owner_id := OLD.owner_id;
    NEW.user_id := OLD.user_id;
    NEW.status := OLD.status;
    NEW.custom_status := OLD.custom_status;
    NEW.payment_method := OLD.payment_method;
    NEW.birth_occurred := OLD.birth_occurred;
    NEW.first_login := OLD.first_login;
  END IF;
  RETURN NEW;
END;
$$;
create or replace function public.restrict_visitor_match_request_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Apenas quando quem edita é a própria visitante (e não a doula/organização)
  if auth.uid() is not null
     and auth.uid() = old.visitor_user_id
     and not public.is_org_member(old.organization_id)
     and not public.is_super_admin()
  then
    -- Trava todos os campos: a visitante só pode alterar o status
    new.id               := old.id;
    new.visitor_user_id  := old.visitor_user_id;
    new.visitor_client_id:= old.visitor_client_id;
    new.organization_id  := old.organization_id;
    new.plan_setting_id  := old.plan_setting_id;
    new.plan_name        := old.plan_name;
    new.plan_value       := old.plan_value;
    new.message          := old.message;
    new.responded_at     := old.responded_at;
    new.responded_by     := old.responded_by;
    new.response_notes   := old.response_notes;
    new.created_at       := old.created_at;
    new.updated_at       := now();
  end if;

  return new;
end;
$$;

drop trigger if exists restrict_visitor_match_request_fields_trg on public.doula_match_requests;

create trigger restrict_visitor_match_request_fields_trg
before update on public.doula_match_requests
for each row
execute function public.restrict_visitor_match_request_fields();
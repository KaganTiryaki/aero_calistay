alter table public.events add column participant_rollout_enabled boolean not null default false;
alter table public.events add column participant_acceptance_enabled boolean not null default false;
alter table public.events add column participant_payment_mutations_enabled boolean not null default false;

create function private.require_participant_gate(p_event uuid,p_feature text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.events where id=p_event and participant_rollout_enabled and
 (p_feature='rollout' or (p_feature='acceptance' and participant_acceptance_enabled) or (p_feature='payment' and participant_payment_mutations_enabled))) then raise exception 'FEATURE_DISABLED';end if;
end;$$;
revoke all on function private.require_participant_gate(uuid,text) from public,anon,authenticated;

create function private.participant_rollout_open(p_application uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.applications a join public.events e on e.id=a.event_id where a.id=p_application and e.participant_rollout_enabled);
$$;
revoke all on function private.participant_rollout_open(uuid) from public,anon;
grant execute on function private.participant_rollout_open(uuid) to authenticated;
alter policy participant_read_own_membership on public.participant_memberships using(user_id=auth.uid() and private.participant_rollout_open(application_id));
alter policy participant_read_own_application on public.applications using(private.participant_rollout_open(id) and exists(select 1 from public.participant_memberships m where m.user_id=auth.uid() and m.application_id=applications.id));
alter policy participant_read_own_payment on public.payment_submissions using(private.participant_rollout_open(application_id) and exists(select 1 from public.participant_memberships m where m.user_id=auth.uid() and m.application_id=payment_submissions.application_id));

create function private.guard_participant_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
declare event_id uuid;feature text:='rollout';
begin
 if tg_table_name='applications' then
  if tg_op='UPDATE' and new.status='accepted_pending_payment' and old.status is distinct from new.status then feature:='acceptance';
  elsif tg_op='UPDATE' and new.status='confirmed' and old.status is distinct from new.status then feature:='payment';
  elsif tg_op='UPDATE' and new.payment_amount_minor is distinct from old.payment_amount_minor and old.status='accepted_pending_payment' then feature:='payment';
  else return new;end if;
  event_id:=new.event_id;
 elsif tg_table_name='payment_submissions' then
  if tg_op='UPDATE' and new.status in('revoked','superseded') then return new;end if;
  select a.event_id into event_id from public.applications a where a.id=new.application_id;feature:='payment';
 elsif tg_table_name='payment_reviews' then
  select a.event_id into event_id from public.applications a join public.payment_submissions s on s.application_id=a.id where s.id=new.submission_id;feature:='payment';
 elsif tg_table_name='mail_jobs' then
  if new.kind not in('acceptance','participant_auth') then return new;end if;
  if tg_op='UPDATE' and new.auth_prepare_state is not distinct from old.auth_prepare_state then return new;end if;
  if tg_op='UPDATE' and new.auth_prepare_state in('prepared','expired') then return new;end if;
  select a.event_id into event_id from public.applications a where a.id=new.application_id;
  if tg_op='INSERT' and new.kind='acceptance' then feature:='acceptance';end if;
 else
  select a.event_id into event_id from public.applications a where a.id=new.application_id;
 end if;
 perform private.require_participant_gate(event_id,feature);return new;
end;$$;
revoke all on function private.guard_participant_mutation() from public,anon,authenticated;
create trigger applications_rollout_gate before update on public.applications for each row execute function private.guard_participant_mutation();
create trigger payment_submissions_rollout_gate before insert or update on public.payment_submissions for each row execute function private.guard_participant_mutation();
create trigger payment_reviews_rollout_gate before insert on public.payment_reviews for each row execute function private.guard_participant_mutation();
create trigger participant_memberships_rollout_gate before insert on public.participant_memberships for each row execute function private.guard_participant_mutation();
create trigger meal_redemptions_rollout_gate before insert on public.meal_redemptions for each row execute function private.guard_participant_mutation();
create trigger auth_jobs_rollout_gate before insert or update on public.mail_jobs for each row execute function private.guard_participant_mutation();

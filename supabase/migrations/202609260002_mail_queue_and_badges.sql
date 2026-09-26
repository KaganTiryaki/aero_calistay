create function public.claim_mail_jobs(p_worker uuid, p_limit integer default 20)
returns setof public.mail_jobs language plpgsql security definer set search_path = '' as $$
declare
  v_state public.mail_provider_state%rowtype;
  v_date date := (now() at time zone 'Europe/Istanbul')::date;
  v_slots integer;
  v_id uuid;
  v_count integer := 0;
begin
  update public.mail_jobs set status = 'uncertain', lease_owner = null, lease_until = null,
    last_error = 'İşleyici yanıtı kayboldu; sağlayıcı olayı araştırılmalı.', updated_at = now()
    where status = 'sending' and lease_until < now();
  select * into v_state from public.mail_provider_state where id = 1 for update;
  if v_state.sent_day is distinct from v_date then
    update public.mail_provider_state set sent_day = v_date, reserved_today = 0 where id = 1;
    v_state.reserved_today := 0;
  end if;
  v_slots := greatest(0, v_state.approval_budget - v_state.reserved_today);
  if v_state.send_blocked_until is not null and v_state.send_blocked_until > now() then
    v_slots := 0;
  end if;
  if v_state.provider_remaining is not null then
    v_slots := least(v_slots, greatest(0, v_state.provider_remaining - v_state.auth_reserve));
  end if;
  v_slots := least(v_slots, greatest(0, least(p_limit, 20)));
  for v_id in
    select id from public.mail_jobs
      where status in ('queued', 'quota_wait') and next_attempt_at <= now()
      order by created_at for update skip locked limit v_slots
  loop
    update public.mail_jobs set status = 'sending', lease_owner = p_worker,
      lease_until = now() + interval '2 minutes', first_send_at = coalesce(first_send_at, now()),
      attempts = attempts + 1, updated_at = now() where id = v_id;
    v_count := v_count + 1;
    return query select * from public.mail_jobs where id = v_id;
  end loop;
  update public.mail_provider_state set reserved_today = reserved_today + v_count,
    provider_remaining = case when provider_remaining is null then null else greatest(0, provider_remaining - v_count) end,
    worker_heartbeat_at = now() where id = 1;
  if v_slots = 0 then
    update public.mail_jobs set status = 'quota_wait', updated_at = now()
      where status = 'queued' and next_attempt_at <= now();
  end if;
end;
$$;
revoke all on function public.claim_mail_jobs(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_mail_jobs(uuid, integer) to service_role;

create function public.mark_mail_job(
  p_job_id uuid, p_worker uuid, p_status public.mail_job_status,
  p_message_id text default null, p_error text default null,
  p_next_attempt timestamptz default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_updated uuid;
begin
  if p_status not in ('provider_accepted', 'uncertain', 'quota_wait', 'queued', 'failed') then
    raise exception 'INVALID_STATUS';
  end if;
  update public.mail_jobs set status = p_status, provider_message_id = coalesce(p_message_id, provider_message_id),
    last_error = left(p_error, 500), next_attempt_at = coalesce(p_next_attempt, next_attempt_at),
    lease_owner = null, lease_until = null, updated_at = now()
    where id = p_job_id and status = 'sending' and lease_owner = p_worker and lease_until > now()
    returning id into v_updated;
  if v_updated is not null and p_status in ('quota_wait', 'queued', 'failed') then
    update public.mail_provider_state set reserved_today = greatest(0, reserved_today - 1),
      send_blocked_until = case when p_status in ('quota_wait', 'queued') and p_next_attempt is not null
        then greatest(coalesce(send_blocked_until, p_next_attempt), p_next_attempt)
        else send_blocked_until end where id = 1;
  end if;
  return v_updated is not null;
end;
$$;
revoke all on function public.mark_mail_job(uuid, uuid, public.mail_job_status, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_mail_job(uuid, uuid, public.mail_job_status, text, text, timestamptz) to service_role;

create function public.cancel_application(p_application_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_event uuid;
  v_application public.applications%rowtype;
begin
  select event_id into v_event from public.staff_members where user_id = v_actor and role = 'admin' and active;
  if v_event is null then raise exception 'FORBIDDEN'; end if;
  select * into v_application from public.applications
    where id = p_application_id and event_id = v_event for update;
  if not found then return false; end if;
  update public.applications set status = 'cancelled', version = version + 1,
    updated_at = now() where id = v_application.id;
  update public.qr_credentials set active = false where application_id = v_application.id;
  update public.mail_jobs set status = 'cancelled', updated_at = now()
    where application_id = v_application.id and status in ('queued', 'quota_wait', 'failed');
  insert into public.audit_logs(actor_id, action, target_id) values (v_actor, 'application_cancelled', p_application_id);
  return true;
end;
$$;
revoke all on function public.cancel_application(uuid) from public, anon;
grant execute on function public.cancel_application(uuid) to authenticated;

create function public.rotate_qr(p_application_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_event uuid;
  v_application public.applications%rowtype;
  v_raw text;
  v_code text;
begin
  select event_id into v_event from public.staff_members where user_id = v_actor and role = 'admin' and active;
  if v_event is null then raise exception 'FORBIDDEN'; end if;
  select * into v_application from public.applications
    where id = p_application_id and event_id = v_event for update;
  if not found or v_application.status <> 'approved' then return false; end if;
  v_raw := 'AERO1:' || rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
  update public.qr_credentials set raw_value = v_raw,
    value_hash = encode(extensions.digest(v_raw, 'sha256'), 'hex'), manual_code = v_code,
    active = true, version = version + 1, created_at = now()
    where application_id = v_application.id;
  if not found then return false; end if;
  insert into public.audit_logs(actor_id, action, target_id) values (v_actor, 'qr_rotated', p_application_id);
  return true;
end;
$$;
revoke all on function public.rotate_qr(uuid) from public, anon;
grant execute on function public.rotate_qr(uuid) to authenticated;

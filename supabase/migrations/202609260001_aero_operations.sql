-- AERO single-event operations. Apply only to a dedicated Supabase project.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create type public.staff_role as enum ('admin', 'staff');
create type public.application_status as enum ('pending', 'approval_queued', 'approved', 'cancelled');
create type public.mail_job_status as enum ('queued', 'sending', 'quota_wait', 'provider_accepted', 'sent', 'failed', 'uncertain', 'cancelled');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  check_in_open boolean not null default false,
  timezone text not null default 'Europe/Istanbul',
  created_at timestamptz not null default now()
);
insert into public.events (name) values ('AERO Sirkülasyon Çalıştayı');

create table public.staff_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id),
  role public.staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.committees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  name text not null check (length(btrim(name)) between 1 and 120),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, event_id)
);
create unique index committees_event_name_key on public.committees (event_id, lower(btrim(name)));

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  first_name text not null check (length(btrim(first_name)) between 1 and 120),
  last_name text not null check (length(btrim(last_name)) between 1 and 120),
  email text not null check (email = lower(btrim(email)) and length(email) <= 254),
  committee_id uuid,
  status public.application_status not null default 'pending',
  version integer not null default 1 check (version > 0),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (committee_id, event_id) references public.committees(id, event_id),
  unique (event_id, email),
  unique (id, event_id)
);
create index applications_event_status_idx on public.applications (event_id, status, created_at desc);

create table public.mail_batches (
  id uuid primary key,
  event_id uuid not null references public.events(id),
  created_by uuid not null references auth.users(id),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  total integer not null check (total between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.mail_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.mail_batches(id),
  application_id uuid not null references public.applications(id),
  approval_version integer not null,
  recipient_email text not null,
  recipient_name text not null,
  committee_name text not null,
  subject text not null,
  html_content text not null,
  text_content text not null,
  tag text not null unique,
  idempotency_key uuid not null unique default gen_random_uuid(),
  status public.mail_job_status not null default 'queued',
  delivery_status text not null default 'unknown',
  last_delivery_event_at timestamptz,
  attempts integer not null default 0,
  first_send_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_owner uuid,
  lease_until timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, approval_version)
);
create index mail_jobs_queue_idx on public.mail_jobs (status, next_attempt_at, created_at);
create index mail_jobs_message_idx on public.mail_jobs (provider_message_id);

create table public.mail_provider_state (
  id integer primary key default 1 check (id = 1),
  approval_budget integer not null default 290 check (approval_budget between 0 and 300),
  auth_reserve integer not null default 10 check (auth_reserve between 0 and 300),
  sent_day date,
  reserved_today integer not null default 0,
  provider_remaining integer,
  provider_checked_at timestamptz,
  send_blocked_until timestamptz,
  worker_heartbeat_at timestamptz,
  reconciliation_heartbeat_at timestamptz
);
insert into public.mail_provider_state(id) values (1);

create table public.qr_credentials (
  application_id uuid primary key references public.applications(id),
  raw_value text not null unique,
  value_hash text not null unique,
  manual_code text not null unique,
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  application_id uuid not null references public.applications(id),
  staff_user_id uuid not null references auth.users(id),
  request_id uuid not null unique,
  checked_in_at timestamptz not null default now(),
  unique (event_id, application_id)
);

create table public.check_in_attempts (
  user_id uuid not null references auth.users(id),
  minute timestamptz not null,
  attempts integer not null default 1,
  primary key (user_id, minute)
);

create table public.mail_events (
  fingerprint text primary key,
  job_id uuid references public.mail_jobs(id),
  message_id text not null,
  recipient_email text not null,
  event_name text not null,
  provider_time timestamptz,
  processed boolean not null default false,
  received_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_id uuid,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function private.has_staff_role(p_role public.staff_role default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = (select auth.uid()) and s.active
      and (p_role is null or s.role = p_role)
  );
$$;
revoke all on function private.has_staff_role(public.staff_role) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_staff_role(public.staff_role) to authenticated;

alter table public.events enable row level security;
alter table public.staff_members enable row level security;
alter table public.committees enable row level security;
alter table public.applications enable row level security;
alter table public.mail_batches enable row level security;
alter table public.mail_jobs enable row level security;
alter table public.mail_provider_state enable row level security;
alter table public.qr_credentials enable row level security;
alter table public.check_ins enable row level security;
alter table public.check_in_attempts enable row level security;
alter table public.mail_events enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.events, public.committees, public.applications, public.mail_batches,
  public.mail_jobs, public.mail_provider_state, public.check_ins, public.audit_logs to authenticated;

create policy admin_read_events on public.events for select to authenticated
  using ((select private.has_staff_role('admin')));
create policy admin_write_events on public.events for update to authenticated
  using ((select private.has_staff_role('admin'))) with check ((select private.has_staff_role('admin')));
create policy admin_read_staff on public.staff_members for select to authenticated
  using ((select private.has_staff_role('admin')));
create policy admin_read_committees on public.committees for select to authenticated
  using ((select private.has_staff_role('admin')));
create policy admin_insert_committees on public.committees for insert to authenticated
  with check ((select private.has_staff_role('admin')));
create policy admin_update_committees on public.committees for update to authenticated
  using ((select private.has_staff_role('admin'))) with check ((select private.has_staff_role('admin')));
create policy admin_read_applications on public.applications for select to authenticated
  using ((select private.has_staff_role('admin')));
create policy admin_insert_applications on public.applications for insert to authenticated
  with check ((select private.has_staff_role('admin')));
create policy admin_update_applications on public.applications for update to authenticated
  using ((select private.has_staff_role('admin'))) with check ((select private.has_staff_role('admin')));
create policy admin_read_batches on public.mail_batches for select to authenticated
  using ((select private.has_staff_role('admin')));
create policy admin_read_jobs on public.mail_jobs for select to authenticated
  using ((select private.has_staff_role('admin')));
create policy admin_read_provider on public.mail_provider_state for select to authenticated
  using ((select private.has_staff_role('admin')));
create policy admin_read_checkins on public.check_ins for select to authenticated
  using ((select private.has_staff_role('admin')));
create policy admin_read_audit on public.audit_logs for select to authenticated
  using ((select private.has_staff_role('admin')));

-- No direct authenticated policy on QR secrets, mail events or rate-limit state.
-- Privileged application routes and narrow RPCs are the only access paths.

create function public.queue_approval_batch(p_batch_id uuid, p_actor uuid, p_jobs jsonb, p_request_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
  v_job jsonb;
  v_app public.applications%rowtype;
  v_committee public.committees%rowtype;
  v_new uuid;
  v_job_id uuid;
  v_existing public.mail_batches%rowtype;
begin
  if jsonb_typeof(p_jobs) <> 'array' or jsonb_array_length(p_jobs) not between 1 and 500
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_BATCH';
  end if;
  select event_id into v_event from public.staff_members where user_id = p_actor and role = 'admin' and active;
  if v_event is null then raise exception 'FORBIDDEN'; end if;
  insert into public.mail_batches (id, event_id, created_by, request_hash, total)
    values (p_batch_id, v_event, p_actor, p_request_hash, jsonb_array_length(p_jobs))
    on conflict (id) do nothing returning id into v_new;
  if v_new is null then
    select * into v_existing from public.mail_batches where id = p_batch_id for update;
    if v_existing.event_id <> v_event or v_existing.created_by <> p_actor
      or v_existing.request_hash <> p_request_hash then raise exception 'BATCH_CONFLICT'; end if;
    return p_batch_id;
  end if;
  for v_job in select value from jsonb_array_elements(p_jobs) loop
    select * into v_app from public.applications
      where id = (v_job->>'applicationId')::uuid and event_id = v_event for update;
    if not found or v_app.status <> 'pending' or v_app.version <> (v_job->>'version')::integer
      or v_app.email <> (v_job->>'email') then raise exception 'STALE_APPLICATION'; end if;
    select * into v_committee from public.committees
      where id = (v_job->>'committeeId')::uuid and event_id = v_event and active;
    if not found then raise exception 'INVALID_COMMITTEE'; end if;
    v_job_id := gen_random_uuid();
    insert into public.mail_jobs (
      id, batch_id, application_id, approval_version, recipient_email, recipient_name,
      committee_name, subject, html_content, text_content, tag
    ) values (
      v_job_id, p_batch_id, v_app.id, v_app.version + 1, v_app.email,
      v_app.first_name || ' ' || v_app.last_name, v_committee.name,
      v_job->>'subject', v_job->>'html', v_job->>'text', 'aero-job-' || v_job_id::text
    );
    update public.applications set status = 'approval_queued', committee_id = v_committee.id,
      version = version + 1, updated_at = now() where id = v_app.id;
  end loop;
  insert into public.audit_logs(actor_id, action, target_id, summary)
    values (p_actor, 'batch_created', p_batch_id, jsonb_build_object('count', jsonb_array_length(p_jobs)));
  return p_batch_id;
end;
$$;
revoke all on function public.queue_approval_batch(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.queue_approval_batch(uuid, uuid, jsonb, text) to service_role;

create function public.record_mail_event(
  p_fingerprint text, p_tag text, p_message_id text, p_email text,
  p_event text, p_provider_time timestamptz
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_job public.mail_jobs%rowtype;
  v_app public.applications%rowtype;
  v_raw text;
  v_code text;
begin
  select * into v_job from public.mail_jobs where tag = p_tag for update;
  if not found or v_job.recipient_email <> lower(btrim(p_email))
    or (v_job.provider_message_id is not null and
      lower(btrim(btrim(v_job.provider_message_id), '<>')) <>
      lower(btrim(btrim(p_message_id), '<>'))) then
    return false;
  end if;
  insert into public.mail_events(fingerprint, job_id, message_id, recipient_email, event_name, provider_time)
    values (p_fingerprint, v_job.id, p_message_id, lower(btrim(p_email)), p_event, p_provider_time)
    on conflict (fingerprint) do nothing;
  if not found then return true; end if;
  update public.mail_jobs set provider_message_id = coalesce(provider_message_id, p_message_id),
    delivery_status = case when p_provider_time is not null and
      (last_delivery_event_at is null or p_provider_time >= last_delivery_event_at) then case p_event
      when 'delivered' then 'delivered' when 'deferred' then 'deferred'
      when 'hard_bounce' then 'hard_bounced' when 'soft_bounce' then 'soft_bounced'
      when 'blocked' then 'blocked' when 'invalid_email' then 'invalid'
      when 'spam' then 'complained' when 'error' then 'error'
      when 'unsubscribed' then 'unsubscribed' else delivery_status end else delivery_status end,
    last_delivery_event_at = case when p_event in ('delivered', 'deferred', 'hard_bounce',
      'soft_bounce', 'blocked', 'invalid_email', 'spam', 'error', 'unsubscribed') and
      p_provider_time is not null and (last_delivery_event_at is null or p_provider_time >= last_delivery_event_at)
      then p_provider_time else last_delivery_event_at end,
    status = case when p_event in ('request', 'delivered') then 'sent' else status end,
    updated_at = now() where id = v_job.id;
  if p_event in ('request', 'delivered') then
    select * into v_app from public.applications where id = v_job.application_id for update;
    if v_app.status = 'approval_queued' and v_app.version = v_job.approval_version then
      update public.applications set status = 'approved', approved_at = now(), updated_at = now()
        where id = v_app.id;
      v_raw := 'AERO1:' || rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
      v_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
      insert into public.qr_credentials(application_id, raw_value, value_hash, manual_code)
        values (v_app.id, v_raw, encode(extensions.digest(v_raw, 'sha256'), 'hex'), v_code)
        on conflict (application_id) do nothing;
    end if;
  end if;
  update public.mail_events set processed = true where fingerprint = p_fingerprint;
  return true;
end;
$$;
revoke all on function public.record_mail_event(text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_mail_event(text, text, text, text, text, timestamptz) to service_role;

create function public.check_in_code(p_code text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_event public.events%rowtype;
  v_app public.applications%rowtype;
  v_existing public.check_ins%rowtype;
  v_committee_name text;
  v_qr_active boolean;
  v_attempts integer;
  v_inserted uuid;
begin
  select e.* into v_event from public.events e join public.staff_members s on s.event_id = e.id
    where s.user_id = v_actor and s.active limit 1;
  if not found then raise exception 'FORBIDDEN'; end if;
  insert into public.check_in_attempts(user_id, minute, attempts)
    values (v_actor, date_trunc('minute', now()), 1)
    on conflict (user_id, minute) do update set attempts = public.check_in_attempts.attempts + 1
    returning attempts into v_attempts;
  if v_attempts > 60 then raise exception 'RATE_LIMIT'; end if;
  if not v_event.check_in_open then return jsonb_build_object('result', 'closed'); end if;
  if length(p_code) > 80 then return jsonb_build_object('result', 'invalid'); end if;
  select a.* into v_app from public.applications a
    join public.qr_credentials q on q.application_id = a.id
    where a.event_id = v_event.id and
      (q.value_hash = encode(extensions.digest(p_code, 'sha256'), 'hex') or q.manual_code = upper(p_code))
    for update of a;
  if not found then return jsonb_build_object('result', 'invalid'); end if;
  select active into v_qr_active from public.qr_credentials where application_id = v_app.id;
  if v_app.status <> 'approved' or not v_qr_active then return jsonb_build_object('result', 'inactive'); end if;
  select name into v_committee_name from public.committees where id = v_app.committee_id;
  select * into v_existing from public.check_ins where event_id = v_event.id and application_id = v_app.id;
  if found then
    return jsonb_build_object('result', case when v_existing.request_id = p_request_id then 'recorded' else 'already' end,
      'firstName', v_app.first_name, 'lastName', v_app.last_name,
      'committee', v_committee_name, 'checkedInAt', v_existing.checked_in_at);
  end if;
  insert into public.check_ins(event_id, application_id, staff_user_id, request_id)
    values (v_event.id, v_app.id, v_actor, p_request_id)
    on conflict (event_id, application_id) do nothing returning id into v_inserted;
  if v_inserted is null then
    select * into v_existing from public.check_ins where event_id = v_event.id and application_id = v_app.id;
    return jsonb_build_object('result', case when v_existing.request_id = p_request_id then 'recorded' else 'already' end,
      'firstName', v_app.first_name, 'lastName', v_app.last_name,
      'committee', v_committee_name, 'checkedInAt', v_existing.checked_in_at);
  end if;
  insert into public.audit_logs(actor_id, action, target_id) values (v_actor, 'check_in', v_app.id);
  return jsonb_build_object('result', 'recorded', 'firstName', v_app.first_name,
    'lastName', v_app.last_name, 'committee', v_committee_name, 'checkedInAt', now());
end;
$$;
revoke all on function public.check_in_code(text, uuid) from public, anon;
grant execute on function public.check_in_code(text, uuid) to authenticated;

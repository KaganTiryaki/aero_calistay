create table public.admin_login_rate_limits (
  id bigint generated always as identity primary key,
  ip_address inet,
  device_id uuid,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_failure_at timestamptz,
  blocked_until timestamptz,
  suspicious boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ip_address is not null or device_id is not null)
);

create unique index admin_login_rate_limits_ip_device_idx on public.admin_login_rate_limits
  (coalesce(ip_address::text, ''), coalesce(device_id::text, ''));
alter table public.admin_login_rate_limits enable row level security;
revoke all on public.admin_login_rate_limits from anon, authenticated;

create or replace function private.login_rate_limit_key(p_ip inet, p_device_id uuid)
returns text language sql immutable as $$
  select coalesce(p_ip::text, '') || '|' || coalesce(p_device_id::text, '')
$$;

create or replace function private.check_admin_login_rate_limit(p_ip inet, p_device_id uuid, p_now timestamptz default now())
returns table(allowed boolean, wait_seconds integer, failure_count integer, suspicious boolean)
language plpgsql security definer set search_path = public, private as $$
declare r public.admin_login_rate_limits%rowtype;
begin
  select * into r from public.admin_login_rate_limits
  where coalesce(ip_address::text, '') = coalesce(p_ip::text, '') and coalesce(device_id::text, '') = coalesce(p_device_id::text, '')
  for update;
  if not found then return query select true, 0, 0, false; return; end if;
  if r.blocked_until is not null and r.blocked_until > p_now then
    return query select false, greatest(1, ceil(extract(epoch from (r.blocked_until - p_now)))::integer), r.failure_count, true;
  end if;
  return query select true, 0, r.failure_count, r.suspicious;
end $$;

create or replace function private.record_admin_login_failure(p_ip inet, p_device_id uuid, p_now timestamptz default now())
returns table(allowed boolean, wait_seconds integer, failure_count integer, suspicious boolean)
language plpgsql security definer set search_path = public, private as $$
declare r public.admin_login_rate_limits%rowtype; n integer; delay_seconds integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(private.login_rate_limit_key(p_ip, p_device_id), 0));
  select * into r from public.admin_login_rate_limits
  where coalesce(ip_address::text, '') = coalesce(p_ip::text, '') and coalesce(device_id::text, '') = coalesce(p_device_id::text, '')
  for update;
  if found and r.blocked_until is not null and r.blocked_until > p_now then
    return query select false, greatest(1, ceil(extract(epoch from (r.blocked_until - p_now)))::integer), r.failure_count, true; return;
  end if;
  n := coalesce(r.failure_count, 0) + 1;
  delay_seconds := case when n >= 5 then 900 else power(2, n - 1)::integer end;
  insert into public.admin_login_rate_limits(ip_address, device_id, failure_count, last_failure_at, blocked_until, suspicious, updated_at)
  values (p_ip, p_device_id, n, p_now, case when n >= 5 then p_now + make_interval(secs => delay_seconds) else null end, n >= 4, p_now)
  on conflict ((coalesce(ip_address::text, '')), (coalesce(device_id::text, ''))) do update set
    failure_count = excluded.failure_count, last_failure_at = excluded.last_failure_at, blocked_until = excluded.blocked_until,
    suspicious = excluded.suspicious, updated_at = excluded.updated_at
  returning * into r;
  return query select true, delay_seconds, r.failure_count, r.suspicious;
end $$;

create or replace function private.reset_admin_login_failures(p_ip inet, p_device_id uuid)
returns void language sql security definer set search_path = public, private as $$
  delete from public.admin_login_rate_limits
  where coalesce(ip_address::text, '') = coalesce(p_ip::text, '') and coalesce(device_id::text, '') = coalesce(p_device_id::text, '')
$$;

revoke all on function private.check_admin_login_rate_limit(inet, uuid, timestamptz) from public;
revoke all on function private.record_admin_login_failure(inet, uuid, timestamptz) from public;
revoke all on function private.reset_admin_login_failures(inet, uuid) from public;

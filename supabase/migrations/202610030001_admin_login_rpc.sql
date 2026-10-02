-- PostgREST exposes public, while the rate-limit implementation stays private.
create function public.check_admin_login_rate_limit(p_ip inet,p_device_id uuid,p_now timestamptz default now())
returns table(allowed boolean,wait_seconds integer,failure_count integer,suspicious boolean)
language sql security definer set search_path='' as $$
  select * from private.check_admin_login_rate_limit(p_ip,p_device_id,p_now)
$$;

create function public.record_admin_login_failure(p_ip inet,p_device_id uuid,p_now timestamptz default now())
returns table(allowed boolean,wait_seconds integer,failure_count integer,suspicious boolean)
language sql security definer set search_path='' as $$
  select * from private.record_admin_login_failure(p_ip,p_device_id,p_now)
$$;

create function public.reset_admin_login_failures(p_ip inet,p_device_id uuid)
returns void language sql security definer set search_path='' as $$
  select private.reset_admin_login_failures(p_ip,p_device_id)
$$;

revoke all on function public.check_admin_login_rate_limit(inet,uuid,timestamptz),
  public.record_admin_login_failure(inet,uuid,timestamptz),public.reset_admin_login_failures(inet,uuid)
  from public,anon,authenticated;
grant execute on function public.check_admin_login_rate_limit(inet,uuid,timestamptz),
  public.record_admin_login_failure(inet,uuid,timestamptz),public.reset_admin_login_failures(inet,uuid)
  to service_role;

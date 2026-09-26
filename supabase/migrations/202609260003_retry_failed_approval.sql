alter table public.mail_jobs add column reopened_at timestamptz;

create function public.reopen_failed_approval(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_job public.mail_jobs%rowtype;
  v_app public.applications%rowtype;
begin
  select * into v_job from public.mail_jobs where id = p_job_id for update;
  if not found or v_job.status <> 'failed' or v_job.reopened_at is not null then return false; end if;
  select * into v_app from public.applications where id = v_job.application_id for update;
  if not found or v_app.status <> 'approval_queued'
    or v_app.version <> v_job.approval_version then return false; end if;
  if not exists (
    select 1 from public.staff_members
    where user_id = v_actor and event_id = v_app.event_id and role = 'admin' and active
  ) then raise exception 'FORBIDDEN'; end if;
  update public.applications set status = 'pending', committee_id = null,
    version = version + 1, updated_at = now() where id = v_app.id;
  update public.mail_jobs set reopened_at = now(), updated_at = now() where id = p_job_id;
  insert into public.audit_logs(actor_id, action, target_id, summary)
    values (v_actor, 'failed_approval_reopened', v_app.id, jsonb_build_object('job_id', p_job_id));
  return true;
end;
$$;
revoke all on function public.reopen_failed_approval(uuid) from public, anon;
grant execute on function public.reopen_failed_approval(uuid) to authenticated;

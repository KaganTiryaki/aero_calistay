create or replace function public.retry_participant_invite(p_job_id uuid,p_email text)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;j public.mail_jobs%rowtype;v_email text:=lower(btrim(p_email));fresh_batch uuid;
begin
 select a0.* into a from public.applications a0 join public.mail_jobs j0 on j0.application_id=a0.id where j0.id=p_job_id for update of a0;
 if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN';end if;
 perform private.require_participant_gate(a.event_id,'acceptance');
 select * into j from public.mail_jobs where id=p_job_id for update;
 if j.kind not in('acceptance','participant_auth') or j.status<>'failed' or a.status<>'accepted_pending_payment' or exists(select 1 from public.participant_memberships where application_id=a.id) then return false;end if;
 if v_email is null or length(v_email) not between 3 and 254 or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' then raise exception 'INVALID_EMAIL';end if;
 if v_email=a.email and j.auth_prepare_state='prepared' and exists(select 1 from public.participant_auth_mail_payloads where job_id=j.id and expires_at>now()) then
  update public.mail_jobs set status='queued',lease_owner=null,lease_until=null,next_attempt_at=now(),last_error=null,updated_at=now() where id=j.id;
 else
  -- Explicit re-invite gets a new job; original provider/audit/payload remains intact.
  update public.mail_jobs set status='cancelled',lease_owner=null,lease_until=null,updated_at=now() where id=j.id;
  if v_email<>a.email then
   update public.applications set email=v_email,version=version+1,updated_at=now() where id=a.id;
   update public.participant_invites set email=v_email,status='queued',auth_user_id=null,updated_at=now() where application_id=a.id;
  end if;
  fresh_batch:=public.request_participant_auth_mail(v_email,'activate',gen_random_uuid());
  if fresh_batch is null then raise exception 'REQUEST_CONFLICT';end if;
 end if;
 insert into public.audit_logs(actor_id,action,target_id,summary) values(auth.uid(),'participant_invite_retry',a.id,jsonb_build_object('originalJob',j.id,'newBatch',fresh_batch,'emailChanged',v_email<>a.email));
 return true;
end;$$;

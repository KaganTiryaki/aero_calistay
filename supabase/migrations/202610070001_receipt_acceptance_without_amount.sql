-- Accepting a reviewed receipt is sufficient for the one-click panel flow.
-- No expected or manually entered amount is required for this decision.
create or replace function public.approve_payment_receipt(
  p_submission_id uuid,
  p_expected_version integer,
  p_request_id uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare
  s public.payment_submissions%rowtype;
  a public.applications%rowtype;
  r public.payment_reviews%rowtype;
  v_raw text;
begin
  -- Keep the same lock order as payment approval, receipt upload, and cancellation.
  select a0.* into a
  from public.applications a0
  join public.payment_submissions s0 on s0.application_id=a0.id
  where s0.id=p_submission_id for update of a0;
  if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN'; end if;

  select * into s from public.payment_submissions where id=p_submission_id for update;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;

  select * into r from public.payment_reviews where request_id=p_request_id or submission_id=s.id;
  if found then
    if r.request_id=p_request_id and r.submission_id=s.id
      and r.review_source='receipt' and r.decision='approved' then return true; end if;
    raise exception 'REQUEST_CONFLICT';
  end if;

  if a.status<>'accepted_pending_payment' then raise exception 'APPLICATION_INACTIVE'; end if;
  if s.status<>'under_review' or s.storage_object_id is null or s.file_sha256 is null then raise exception 'NOT_REVIEWABLE'; end if;
  if s.version is distinct from p_expected_version then raise exception 'STALE_PAYMENT'; end if;

  insert into public.payment_reviews(submission_id,bank_reference,amount_minor,transaction_at,decision,decided_by,request_id,review_source)
  values(s.id,null,null,null,'approved',auth.uid(),p_request_id,'receipt');
  update public.payment_submissions set status='approved' where id=s.id;
  update public.applications set status='confirmed',approved_at=now(),version=version+1,updated_at=now() where id=a.id;

  v_raw:='AERO1:'||rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
  insert into public.qr_credentials(application_id,raw_value,value_hash,manual_code)
  values(a.id,v_raw,encode(extensions.digest(v_raw,'sha256'),'hex'),upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10)))
  on conflict(application_id) do update set raw_value=excluded.raw_value,value_hash=excluded.value_hash,
    manual_code=excluded.manual_code,active=true,version=public.qr_credentials.version+1;

  insert into public.audit_logs(actor_id,action,target_id,summary)
  values(auth.uid(),'payment_approved',a.id,jsonb_build_object('submissionId',s.id,'reviewSource','receipt'));
  insert into public.mail_batches(id,event_id,created_by,request_hash,total)
  values(gen_random_uuid(),a.event_id,auth.uid(),encode(extensions.digest(a.id::text||':confirmation:'||(a.version+1)::text,'sha256'),'hex'),1);
  insert into public.mail_jobs(batch_id,application_id,approval_version,recipient_email,recipient_name,committee_name,subject,html_content,text_content,tag,kind)
  select b.id,a.id,a.version+1,a.email,a.first_name||' '||a.last_name,c.name,'AERO — Kesin kabul ve QR',
    '<p>Dekontunuz kabul edildi. Başvurunuz kesin kabul edildi.</p><p><a href="'||e.participant_portal_url||'">Başvurumu ve QR’ımı görüntüle</a></p>',
    'Dekontunuz kabul edildi. Başvurunuz kesin kabul edildi. Başvurunuz ve QR: '||e.participant_portal_url,
    'aero-confirmation-'||a.id||'-'||(a.version+1),'confirmation'
  from public.mail_batches b
  join public.committees c on c.id=a.committee_id
  join public.events e on e.id=a.event_id
  where b.event_id=a.event_id and b.created_by=auth.uid()
    and b.request_hash=encode(extensions.digest(a.id::text||':confirmation:'||(a.version+1)::text,'sha256'),'hex');
  return true;
end; $$;

revoke all on function public.approve_payment_receipt(uuid,integer,uuid) from public,anon;
grant execute on function public.approve_payment_receipt(uuid,integer,uuid) to authenticated;

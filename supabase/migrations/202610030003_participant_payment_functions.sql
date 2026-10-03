alter table public.events add column if not exists participant_portal_url text;
alter table public.events add column if not exists payment_iban text;
alter table public.events add column if not exists payment_amount_minor integer;
alter table public.events add column if not exists payment_currency text not null default 'TRY';
alter table public.events add column if not exists payment_deadline timestamptz;
alter table public.mail_jobs add column if not exists kind text not null default 'approval';
alter table public.mail_jobs drop constraint if exists mail_jobs_application_id_approval_version_key;
create unique index if not exists mail_jobs_application_kind_version_key on public.mail_jobs(application_id,kind,approval_version);

create table public.participant_memberships (user_id uuid primary key references auth.users(id) on delete cascade, application_id uuid unique not null references public.applications(id), created_at timestamptz not null default now());
create table public.participant_invites (id uuid primary key default gen_random_uuid(), application_id uuid unique not null references public.applications(id), email text not null, status text not null default 'queued', token_hash text, expires_at timestamptz, created_at timestamptz not null default now());
create table public.payment_submissions (id uuid primary key default gen_random_uuid(), application_id uuid not null references public.applications(id), version integer not null default 1, status text not null default 'not_submitted', storage_object_id text, file_sha256 text, created_at timestamptz not null default now(), unique(application_id, version));
create table public.payment_reviews (id uuid primary key default gen_random_uuid(), submission_id uuid unique not null references public.payment_submissions(id), bank_reference text unique, amount_minor integer, transaction_at timestamptz, decision text not null, reason text, decided_by uuid references auth.users(id), created_at timestamptz not null default now());
create table public.meal_sessions (id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events(id), name text not null, opens_at timestamptz not null, closes_at timestamptz not null, active boolean not null default false, created_at timestamptz not null default now(), check(closes_at > opens_at));
create unique index one_active_meal_per_event on public.meal_sessions(event_id) where active;
create table public.meal_redemptions (id uuid primary key default gen_random_uuid(), meal_session_id uuid not null references public.meal_sessions(id), application_id uuid not null references public.applications(id), staff_user_id uuid not null references auth.users(id), request_id uuid not null unique, redeemed_at timestamptz not null default now(), unique(meal_session_id, application_id));
create table public.participant_auth_link_limits (key_hash text primary key, purpose text not null, window_started_at timestamptz not null, last_requested_at timestamptz not null, request_count integer not null check(request_count>=0));
create table public.participant_auth_mail_payloads (job_id uuid primary key references public.mail_jobs(id) on delete cascade, application_id uuid not null references public.applications(id), nonce text not null, ciphertext text not null, auth_tag text not null, expires_at timestamptz not null, created_at timestamptz not null default now());

alter table public.participant_memberships enable row level security;
alter table public.participant_invites enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.payment_reviews enable row level security;
alter table public.meal_sessions enable row level security;
alter table public.meal_redemptions enable row level security;
alter table public.participant_auth_link_limits enable row level security;
alter table public.participant_auth_mail_payloads enable row level security;
revoke all on public.participant_memberships,public.participant_invites,public.payment_submissions,public.payment_reviews,public.meal_sessions,public.meal_redemptions from anon,authenticated;
revoke all on public.participant_auth_link_limits from public,anon,authenticated;
revoke all on public.participant_auth_mail_payloads from public,anon,authenticated;
grant select on public.meal_sessions to authenticated;
grant select on public.payment_submissions to authenticated;
grant select on public.participant_memberships to authenticated;
create policy participant_read_own_membership on public.participant_memberships for select to authenticated using (user_id=auth.uid());
grant select on public.applications to authenticated;
create policy participant_read_own_application on public.applications for select to authenticated using (exists(select 1 from public.participant_memberships m where m.user_id=auth.uid() and m.application_id=applications.id));
create policy participant_read_own_payment on public.payment_submissions for select to authenticated using (exists(select 1 from public.participant_memberships m where m.user_id=auth.uid() and m.application_id=payment_submissions.application_id));

-- Existing approvals are not treated as paid; only a bank-verified review confirms participation.
alter table public.events add column if not exists participant_portal_url text;
alter table public.applications add column payment_amount_minor integer;
alter table public.applications add column payment_currency text;
alter table public.applications add column payment_iban text;
alter table public.applications add column payment_deadline timestamptz;
alter table public.applications add column payment_reference text;
alter table public.payment_submissions add column expected_mime text;
alter table public.payment_submissions add column expected_size integer;
alter table public.payment_submissions add column review_reason text;
alter table public.payment_reviews add column request_id uuid unique;
alter table public.meal_redemptions add column code_hash text;
alter table public.participant_invites add column last_error text;
alter table public.participant_invites add column auth_user_id uuid references auth.users(id);
alter table public.participant_invites add column updated_at timestamptz not null default now();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('participant-receipts','participant-receipts',false,5242880,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Uploads go through server-issued signed URLs. No broad object policy is added.
-- staff_members is hidden by RLS for staff, so use a scoped SECURITY DEFINER predicate.
create function private.staff_for_event(p_event uuid,p_admin boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff_members where user_id=auth.uid() and event_id=p_event and active and (not p_admin or role='admin'));
$$;
revoke all on function private.staff_for_event(uuid,boolean) from public,anon;
grant execute on function private.staff_for_event(uuid,boolean) to authenticated;
create policy staff_read_event_meals on public.meal_sessions for select to authenticated using(private.staff_for_event(event_id));

create or replace function public.accept_application(p_application_id uuid,p_committee_id uuid,p_expected_version integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype; e public.events%rowtype; v_batch uuid;
begin
 select * into a from public.applications where id=p_application_id for update;
 if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN'; end if;
 if a.status='accepted_pending_payment' and a.committee_id=p_committee_id and a.version=p_expected_version+1 then
  insert into public.mail_batches(id,event_id,created_by,request_hash,total)
   select gen_random_uuid(),a.event_id,auth.uid(),encode(extensions.digest(a.id::text||':acceptance:'||a.version::text,'sha256'),'hex'),1
   where not exists(select 1 from public.mail_jobs where application_id=a.id and kind='acceptance');
  select id into v_batch from public.mail_batches where event_id=a.event_id and created_by=auth.uid()
   and request_hash=encode(extensions.digest(a.id::text||':acceptance:'||a.version::text,'sha256'),'hex') limit 1;
  insert into public.mail_jobs(batch_id,application_id,approval_version,recipient_email,recipient_name,committee_name,subject,html_content,text_content,tag,kind)
   select v_batch,a.id,a.version,a.email,a.first_name||' '||a.last_name,c.name,'AERO Sirkülasyon Çalıştayı — Başvurunuz kabul edildi',
   '<p>Başvurunuz kabul edildi. Kesin katılım için ödeme ve dekont işlemini tamamlayın.</p><p><a href="'||e.participant_portal_url||'">Katılımcı hesabımı aç</a></p>',
   'Başvurunuz kabul edildi. Kesin katılım için ödeme ve dekont işlemini tamamlayın. Katılımcı hesabım: '||e.participant_portal_url,
   'aero-job-'||gen_random_uuid()::text,'acceptance' from public.committees c where c.id=p_committee_id
   and not exists(select 1 from public.mail_jobs j where j.application_id=a.id and j.kind='acceptance')
   and v_batch is not null;
  return true;
 end if;
 if a.version is distinct from p_expected_version then raise exception 'STALE_APPLICATION'; end if;
 if a.status<>'pending' then raise exception 'APPLICATION_INACTIVE'; end if;
 if not exists(select 1 from public.committees where id=p_committee_id and event_id=a.event_id and active) then raise exception 'INVALID_COMMITTEE'; end if;
 select * into e from public.events where id=a.event_id;
 if e.participant_portal_url is null or e.participant_portal_url !~ '^https://[^ /?#]+/katilimci$' then raise exception 'PORTAL_NOT_CONFIGURED'; end if;
 if e.payment_deadline is not null and e.payment_deadline<=now() then raise exception 'PAYMENT_EXPIRED'; end if;
 update public.applications set status='accepted_pending_payment',committee_id=p_committee_id,version=version+1,
 payment_amount_minor=e.payment_amount_minor,payment_currency=e.payment_currency,payment_iban=e.payment_iban,payment_deadline=e.payment_deadline,updated_at=now() where id=a.id;
 insert into public.participant_invites(application_id,email) values(a.id,a.email) on conflict(application_id) do nothing;
 insert into public.mail_batches(id,event_id,created_by,request_hash,total)
  select gen_random_uuid(),a.event_id,auth.uid(),encode(extensions.digest(a.id::text||':acceptance:'||(a.version+1)::text,'sha256'),'hex'),1
  where not exists(select 1 from public.mail_jobs where application_id=a.id and kind='acceptance');
 select id into v_batch from public.mail_batches where event_id=a.event_id and created_by=auth.uid()
  and request_hash=encode(extensions.digest(a.id::text||':acceptance:'||(a.version+1)::text,'sha256'),'hex') limit 1;
 insert into public.mail_jobs(batch_id,application_id,approval_version,recipient_email,recipient_name,committee_name,subject,html_content,text_content,tag,kind)
  select v_batch,
   a.id,a.version+1,a.email,a.first_name||' '||a.last_name,(select name from public.committees where id=p_committee_id),
   'AERO Sirkülasyon Çalıştayı — Başvurunuz kabul edildi',
   '<p>Başvurunuz kabul edildi. Kesin katılım için ödeme ve dekont işlemini tamamlayın.</p><p><a href="'||e.participant_portal_url||'">Katılımcı hesabımı aç</a></p>',
   'Başvurunuz kabul edildi. Kesin katılım için ödeme ve dekont işlemini tamamlayın. Katılımcı hesabım: '||e.participant_portal_url,
   'aero-job-'||gen_random_uuid()::text,'acceptance'
  where not exists(select 1 from public.mail_jobs where application_id=a.id and kind='acceptance') and v_batch is not null;
 insert into public.audit_logs(actor_id,action,target_id) values(auth.uid(),'application_accepted',a.id);
 return true;
end; $$;

create or replace function public.begin_payment_submission(p_application_id uuid,p_mime text,p_size integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype; v_id uuid:=gen_random_uuid(); v_version integer;
begin
 select a0.* into a from public.applications a0 join public.participant_memberships m on m.application_id=a0.id and m.user_id=auth.uid()
 where a0.id=p_application_id for update of a0;
 if not found or a.status<>'accepted_pending_payment' then raise exception 'FORBIDDEN'; end if;
 if a.payment_deadline is not null and a.payment_deadline<=now() then raise exception 'PAYMENT_EXPIRED'; end if;
 if p_size is null or p_size<=0 or p_size>5242880 or p_mime is null or p_mime not in('application/pdf','image/jpeg','image/png') then raise exception 'INVALID_FILE'; end if;
 if exists(select 1 from public.payment_submissions where application_id=a.id and status in('under_review','approved')) then raise exception 'PAYMENT_PENDING'; end if;
 -- A failed upload can be replaced; old versions remain immutable and cannot finalize later.
 update public.payment_submissions set status='superseded' where application_id=a.id and status='not_submitted';
 select coalesce(max(version),0)+1 into v_version from public.payment_submissions where application_id=a.id;
 insert into public.payment_submissions(id,application_id,version,storage_object_id,expected_mime,expected_size)
 values(v_id,a.id,v_version,auth.uid()::text||'/'||a.id::text||'/'||v_id::text,p_mime,p_size);
 return v_id;
end; $$;

create or replace function public.finalize_payment_submission(p_id uuid,p_user uuid,p_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare s public.payment_submissions%rowtype; a public.applications%rowtype;
begin
 select a0.* into a from public.applications a0 join public.payment_submissions s0 on s0.application_id=a0.id where s0.id=p_id for update of a0;
 select * into s from public.payment_submissions where id=p_id for update;
 if s.id is null or p_user is null or not exists(select 1 from public.participant_memberships where application_id=s.application_id and user_id=p_user) then raise exception 'FORBIDDEN'; end if;
 if a.status<>'accepted_pending_payment' then raise exception 'APPLICATION_INACTIVE'; end if;
 if s.status='under_review' and s.file_sha256=p_hash then return true; end if;
 if s.status<>'not_submitted' then raise exception 'STALE_PAYMENT'; end if;
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_FILE'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='participant-receipts' and o.name=s.storage_object_id
 and (o.metadata->>'size')::bigint=s.expected_size and o.metadata->>'mimetype'=s.expected_mime) then raise exception 'UPLOAD_MISSING'; end if;
 update public.payment_submissions set status='under_review',file_sha256=p_hash where id=s.id;
 return true;
end; $$;
revoke all on function public.finalize_payment_submission(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.finalize_payment_submission(uuid,uuid,text) to service_role;

create or replace function public.approve_payment(p_submission_id uuid,p_bank_reference text,p_amount_minor integer,p_transaction_at timestamptz,p_expected_version integer,p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare s public.payment_submissions%rowtype; a public.applications%rowtype; r public.payment_reviews%rowtype; v_raw text; v_reference text:=lower(regexp_replace(p_bank_reference,'\s','','g'));
begin
 -- Always lock application before submission: same order as cancellation and upload.
 select a0.* into a from public.applications a0 join public.payment_submissions s0 on s0.application_id=a0.id where s0.id=p_submission_id for update of a0;
 if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN'; end if;
 select * into s from public.payment_submissions where id=p_submission_id for update;
 if p_request_id is null or v_reference is null or length(v_reference) not between 1 and 200
 or p_amount_minor is null or p_amount_minor<=0 or p_transaction_at is null then raise exception 'INVALID_PAYMENT'; end if;
 select * into r from public.payment_reviews where request_id=p_request_id or submission_id=s.id;
 if found then
  if r.request_id=p_request_id and r.submission_id=s.id and r.bank_reference=v_reference and r.amount_minor=p_amount_minor
  and r.transaction_at=p_transaction_at
  and r.decision='approved' then return true; end if;
  raise exception 'REQUEST_CONFLICT';
 end if;
 if a.status<>'accepted_pending_payment' then raise exception 'APPLICATION_INACTIVE'; end if;
 if s.status<>'under_review' or s.storage_object_id is null or s.file_sha256 is null then raise exception 'NOT_REVIEWABLE'; end if;
 if s.version is distinct from p_expected_version then raise exception 'STALE_PAYMENT'; end if;
 if a.payment_amount_minor is null or a.payment_amount_minor<=0 then raise exception 'PAYMENT_NOT_CONFIGURED'; end if;
 if p_amount_minor<a.payment_amount_minor then raise exception 'INSUFFICIENT'; end if;
 insert into public.payment_reviews(submission_id,bank_reference,amount_minor,transaction_at,decision,decided_by,request_id)
 values(s.id,v_reference,p_amount_minor,p_transaction_at,'approved',auth.uid(),p_request_id);
 update public.payment_submissions set status='approved' where id=s.id;
 update public.applications set status='confirmed',approved_at=now(),version=version+1,updated_at=now() where id=a.id;
 v_raw:='AERO1:'||rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
 insert into public.qr_credentials(application_id,raw_value,value_hash,manual_code)
 values(a.id,v_raw,encode(extensions.digest(v_raw,'sha256'),'hex'),upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10)))
 on conflict(application_id) do update set raw_value=excluded.raw_value,value_hash=excluded.value_hash,manual_code=excluded.manual_code,active=true,version=public.qr_credentials.version+1;
 insert into public.audit_logs(actor_id,action,target_id,summary) values(auth.uid(),'payment_approved',a.id,jsonb_build_object('submissionId',s.id));
 insert into public.mail_batches(id,event_id,created_by,request_hash,total)
 values(gen_random_uuid(),a.event_id,auth.uid(),encode(extensions.digest(a.id::text||':confirmation:'||(a.version+1)::text,'sha256'),'hex'),1);
 insert into public.mail_jobs(batch_id,application_id,approval_version,recipient_email,recipient_name,committee_name,subject,html_content,text_content,tag,kind)
 select b.id,a.id,a.version+1,a.email,a.first_name||' '||a.last_name,c.name,'AERO — Kesin kabul ve QR',
  '<p>Ödemeniz onaylandı. Başvurunuz kesin kabul edildi.</p><p><a href="'||e.participant_portal_url||'">Başvurumu ve QR’ımı görüntüle</a></p>',
  'Ödemeniz onaylandı. Başvurunuz kesin kabul edildi. Başvurunuz ve QR: '||e.participant_portal_url,
  'aero-confirmation-'||a.id||'-'||(a.version+1),'confirmation'
 from public.mail_batches b join public.committees c on c.id=a.committee_id
 join public.events e on e.id=a.event_id where b.event_id=a.event_id and b.created_by=auth.uid()
 and b.request_hash=encode(extensions.digest(a.id::text||':confirmation:'||(a.version+1)::text,'sha256'),'hex');
 return true;
end; $$;

create function public.request_payment_correction(p_submission_id uuid,p_expected_version integer,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype; s public.payment_submissions%rowtype;
begin
 select a0.* into a from public.applications a0 join public.payment_submissions s0 on s0.application_id=a0.id where s0.id=p_submission_id for update of a0;
 if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN'; end if;
 select * into s from public.payment_submissions where id=p_submission_id for update;
 if a.status<>'accepted_pending_payment' or s.status<>'under_review' or s.version is distinct from p_expected_version then raise exception 'STALE_PAYMENT'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'INVALID_REASON'; end if;
 update public.payment_submissions set status='correction_required',review_reason=btrim(p_reason) where id=s.id;
 insert into public.audit_logs(actor_id,action,target_id) values(auth.uid(),'payment_correction',a.id);
 return true;
end; $$;
revoke all on function public.request_payment_correction(uuid,integer,text) from public,anon;
grant execute on function public.request_payment_correction(uuid,integer,text) to authenticated;

create or replace function public.revoke_participation(p_application_id uuid,p_reason text,p_disable_qr boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;
begin
 select * into a from public.applications where id=p_application_id for update;
 if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'INVALID_REASON'; end if;
 update public.applications set status='cancelled',version=version+1,updated_at=now() where id=a.id;
 update public.qr_credentials set active=false where application_id=a.id;
 update public.participant_invites set status='revoked',updated_at=now() where application_id=a.id;
 update public.mail_jobs set status='cancelled' where application_id=a.id and status in('queued','quota_wait','failed');
 insert into public.audit_logs(actor_id,action,target_id,summary) values(auth.uid(),'participation_revoked',a.id,jsonb_build_object('reason',btrim(p_reason)));
 return true;
end; $$;

create or replace function public.rotate_qr(p_application_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype; v_raw text;
begin
 select * into a from public.applications where id=p_application_id for update;
 if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN'; end if;
 if a.status<>'confirmed' then return false; end if;
 v_raw:='AERO1:'||rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
 update public.qr_credentials set raw_value=v_raw,value_hash=encode(extensions.digest(v_raw,'sha256'),'hex'),
 manual_code=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,10)),active=true,version=version+1,created_at=now() where application_id=a.id;
 if not found then return false; end if;
 insert into public.audit_logs(actor_id,action,target_id) values(auth.uid(),'qr_rotated',a.id); return true;
end; $$;

create or replace function public.redeem_meal(p_code text,p_meal_session_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype; m public.meal_sessions%rowtype; r public.meal_redemptions%rowtype; v_name text; v_active boolean; v_attempts integer;
begin
 select * into m from public.meal_sessions where id=p_meal_session_id for share;
 if not found then return jsonb_build_object('result','closed'); end if;
 if not private.staff_for_event(m.event_id) then raise exception 'FORBIDDEN'; end if;
 select * into r from public.meal_redemptions where request_id=p_request_id and meal_session_id=m.id;
 if found then
  if r.code_hash is distinct from encode(extensions.digest(p_code,'sha256'),'hex') then raise exception 'REQUEST_CONFLICT'; end if;
  select a0.* into a from public.applications a0 where a0.id=r.application_id and a0.event_id=m.event_id;
  if a.id is null then raise exception 'REQUEST_CONFLICT'; end if;
  select name into v_name from public.committees where id=a.committee_id;
  return jsonb_build_object('result','recorded','firstName',a.first_name,'lastName',a.last_name,'committee',v_name,'checkedInAt',r.redeemed_at);
 end if;
 if not m.active or now()<m.opens_at or now()>=m.closes_at or not exists(select 1 from public.events where id=m.event_id and check_in_open) then return jsonb_build_object('result','closed'); end if;
 if p_request_id is null or p_code is null or length(p_code) not between 8 and 80 then return jsonb_build_object('result','invalid'); end if;
 insert into public.check_in_attempts(user_id,minute,attempts) values(auth.uid(),date_trunc('minute',now()),1)
 on conflict(user_id,minute) do update set attempts=public.check_in_attempts.attempts+1 returning attempts into v_attempts;
 if v_attempts>60 then return jsonb_build_object('result','rate_limited'); end if;
 select a0.* into a from public.applications a0 join public.qr_credentials q on q.application_id=a0.id
 where a0.event_id=m.event_id and (q.value_hash=encode(extensions.digest(p_code,'sha256'),'hex') or q.manual_code=upper(p_code)) for update of a0;
 if not found then return jsonb_build_object('result','invalid'); end if;
 select active into v_active from public.qr_credentials where application_id=a.id;
 if a.status<>'confirmed' or not v_active then return jsonb_build_object('result','inactive'); end if;
 select name into v_name from public.committees where id=a.committee_id;
 select * into r from public.meal_redemptions where request_id=p_request_id;
 if found and (r.application_id<>a.id or r.meal_session_id<>m.id) then raise exception 'REQUEST_CONFLICT'; end if;
 select * into r from public.meal_redemptions where meal_session_id=m.id and application_id=a.id;
 if not found then
  insert into public.meal_redemptions(meal_session_id,application_id,staff_user_id,request_id,code_hash)
  values(m.id,a.id,auth.uid(),p_request_id,encode(extensions.digest(p_code,'sha256'),'hex')) returning * into r;
  insert into public.audit_logs(actor_id,action,target_id,summary) values(auth.uid(),'meal_redeemed',a.id,jsonb_build_object('mealId',m.id));
 end if;
 return jsonb_build_object('result',case when r.request_id=p_request_id then 'recorded' else 'already' end,
 'firstName',a.first_name,'lastName',a.last_name,'committee',v_name,'checkedInAt',r.redeemed_at);
end; $$;

-- Do not let any older QR producer bypass payment approval.
create function private.require_paid_qr() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.active and not exists(select 1 from public.applications a join public.payment_submissions s on s.application_id=a.id
 join public.payment_reviews r on r.submission_id=s.id where a.id=new.application_id and a.status='confirmed' and s.status='approved' and r.decision='approved') then raise exception 'PAYMENT_REQUIRED'; end if;
 return new;
end; $$;
create trigger qr_requires_payment before insert or update on public.qr_credentials for each row execute function private.require_paid_qr();

create function public.participant_auth_identity(p_application_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_email text; v_id uuid;
begin
 select email into v_email from public.applications where id=p_application_id and status in('accepted_pending_payment','confirmed');
 if not found then raise exception 'APPLICATION_INACTIVE'; end if;
 select id into v_id from auth.users where lower(email)=v_email;
 return v_id;
end; $$;
revoke all on function public.participant_auth_identity(uuid) from public,anon,authenticated;
grant execute on function public.participant_auth_identity(uuid) to service_role;

create function public.find_auth_user_by_email(p_email text)
returns uuid language sql security definer set search_path='' as $$
 select id from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
$$;
revoke all on function public.find_auth_user_by_email(text) from public,anon,authenticated;
grant execute on function public.find_auth_user_by_email(text) to service_role;

create function public.claim_participant_account(p_user_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_email text; a public.applications%rowtype;
begin
 select lower(email) into v_email from auth.users where id=p_user_id and email_confirmed_at is not null;
 if not found then raise exception 'FORBIDDEN'; end if;
 if (select count(*) from public.applications a0 join public.participant_invites i on i.application_id=a0.id
 where a0.email=v_email and a0.status in('accepted_pending_payment','confirmed') and i.status<>'revoked')>1 then raise exception 'REQUEST_CONFLICT'; end if;
 select a0.* into a from public.applications a0 join public.participant_invites i on i.application_id=a0.id
 where a0.email=v_email and a0.status in('accepted_pending_payment','confirmed') and i.status<>'revoked' for update of a0;
 if not found then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.participant_memberships where user_id=p_user_id and application_id<>a.id) then raise exception 'REQUEST_CONFLICT'; end if;
 insert into public.participant_memberships(user_id,application_id) values(p_user_id,a.id) on conflict(user_id) do nothing;
 update public.participant_invites set status='claimed',auth_user_id=p_user_id,updated_at=now() where application_id=a.id;
 return a.id;
end; $$;
revoke all on function public.claim_participant_account(uuid) from public,anon,authenticated;
grant execute on function public.claim_participant_account(uuid) to service_role;

create function public.reserve_participant_auth_link(p_email_hash text,p_ip_hash text,p_purpose text,p_now timestamptz default now())
returns table(allowed boolean,wait_seconds integer) language plpgsql security definer set search_path='' as $$
declare e public.participant_auth_link_limits%rowtype; i public.participant_auth_link_limits%rowtype; e_found boolean; i_found boolean;
begin
 if p_email_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' or p_purpose not in('invite','recovery') then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_email_hash||':'||p_purpose,0));
 select * into e from public.participant_auth_link_limits where key_hash=p_email_hash and purpose=p_purpose for update;
 e_found:=found;
 if e_found and e.last_requested_at>p_now-interval '60 seconds' then return query select false,greatest(1,ceil(extract(epoch from(e.last_requested_at+interval '60 seconds'-p_now)))::integer); return; end if;
 if e_found and e.window_started_at>p_now-interval '1 hour' and e.request_count>=3 then return query select false,greatest(1,ceil(extract(epoch from(e.window_started_at+interval '1 hour'-p_now)))::integer); return; end if;
 perform pg_advisory_xact_lock(hashtextextended('ip:'||p_ip_hash,0));
 select * into i from public.participant_auth_link_limits where key_hash=p_ip_hash and purpose='ip' for update;
 i_found:=found;
 if i_found and i.window_started_at>p_now-interval '1 hour' and i.request_count>=20 then return query select false,greatest(1,ceil(extract(epoch from(i.window_started_at+interval '1 hour'-p_now)))::integer); return; end if;
 insert into public.participant_auth_link_limits(key_hash,purpose,window_started_at,last_requested_at,request_count)
 values(p_email_hash,p_purpose,case when not e_found or e.window_started_at<=p_now-interval '1 hour' then p_now else e.window_started_at end,p_now,case when not e_found or e.window_started_at<=p_now-interval '1 hour' then 1 else e.request_count+1 end)
 on conflict(key_hash) do update set purpose=excluded.purpose,last_requested_at=excluded.last_requested_at,window_started_at=excluded.window_started_at,request_count=excluded.request_count;
 insert into public.participant_auth_link_limits(key_hash,purpose,window_started_at,last_requested_at,request_count)
 values(p_ip_hash,'ip',case when not i_found or i.window_started_at<=p_now-interval '1 hour' then p_now else i.window_started_at end,p_now,case when not i_found or i.window_started_at<=p_now-interval '1 hour' then 1 else i.request_count+1 end)
 on conflict(key_hash) do update set last_requested_at=excluded.last_requested_at,window_started_at=excluded.window_started_at,request_count=excluded.request_count;
 return query select true,0;
end; $$;
revoke all on function public.reserve_participant_auth_link(text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.reserve_participant_auth_link(text,text,text,timestamptz) to service_role;

create function public.queue_participant_auth_mail(p_user_id uuid,p_application_id uuid,p_nonce text,p_ciphertext text,p_auth_tag text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype; i public.participant_invites%rowtype; e public.events%rowtype; c text; b uuid; j uuid;
begin
 if p_user_id is null or p_nonce !~ '^[A-Za-z0-9+/]{16}$' or p_auth_tag !~ '^[A-Za-z0-9+/]{22}==$' or length(p_ciphertext)>16384 then raise exception 'INVALID_REQUEST'; end if;
 select * into a from public.applications where id=p_application_id for update;
 select * into i from public.participant_invites where application_id=p_application_id for update;
 if not found or a.status not in('accepted_pending_payment','confirmed') or i.status='revoked' or lower(a.email)<>(select lower(email) from auth.users where id=p_user_id and email_confirmed_at is not null)
  or (i.auth_user_id is not null and i.auth_user_id<>p_user_id) then raise exception 'FORBIDDEN'; end if;
 if exists(select 1 from public.participant_auth_mail_payloads p join public.mail_jobs m on m.id=p.job_id where p.application_id=a.id and p.expires_at>now() and m.status in('queued','sending','uncertain')) then raise exception 'AUTH_LINK_PENDING'; end if;
 select name into c from public.committees where id=a.committee_id;
 b:=gen_random_uuid(); j:=gen_random_uuid();
 insert into public.mail_batches(id,event_id,created_by,request_hash,total) values(b,a.event_id,p_user_id,encode(extensions.digest(j::text,'sha256'),'hex'),1);
 insert into public.mail_jobs(id,batch_id,application_id,approval_version,recipient_email,recipient_name,committee_name,subject,html_content,text_content,tag,kind)
 values(j,b,a.id,a.version,a.email,a.first_name||' '||a.last_name,coalesce(c,''),'AERO Sirkülasyon Çalıştayı — Hesap bağlantınız',
 '<p>AERO hesabınız için güvenli bağlantı oluşturuldu. Bağlantı e-posta içeriğinde güvenli olarak gönderilecektir.</p>',
 'AERO hesabınız için güvenli bağlantı oluşturuldu.','aero-auth-'||j::text,'participant_auth');
 insert into public.participant_auth_mail_payloads(job_id,application_id,nonce,ciphertext,auth_tag,expires_at) values(j,a.id,p_nonce,p_ciphertext,p_auth_tag,p_expires_at);
 return j;
end; $$;
revoke all on function public.queue_participant_auth_mail(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.queue_participant_auth_mail(uuid,uuid,text,text,text,timestamptz) to service_role;

create function public.read_participant_auth_mail(p_job_id uuid)
returns table(application_id uuid,nonce text,ciphertext text,auth_tag text,expires_at timestamptz,recipient_email text)
language sql security definer set search_path='' as $$
 select p.application_id,p.nonce,p.ciphertext,p.auth_tag,p.expires_at,j.recipient_email
 from public.participant_auth_mail_payloads p join public.mail_jobs j on j.id=p.job_id
 where p.job_id=p_job_id and j.kind in('participant_auth','acceptance') and p.expires_at>now()
$$;
revoke all on function public.read_participant_auth_mail(uuid) from public,anon,authenticated;
grant execute on function public.read_participant_auth_mail(uuid) to service_role;

create function public.store_participant_auth_mail(p_job_id uuid,p_application_id uuid,p_nonce text,p_ciphertext text,p_auth_tag text,p_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.mail_jobs%rowtype; a public.applications%rowtype; i public.participant_invites%rowtype;
begin
 select * into j from public.mail_jobs where id=p_job_id for update;
 select * into a from public.applications where id=p_application_id for update;
 select * into i from public.participant_invites where application_id=p_application_id for update;
 if not found or j.application_id<>a.id or j.kind<>'acceptance' or j.status<>'sending'
  or a.status<>'accepted_pending_payment' or i.status='revoked' or j.recipient_email<>a.email
  or p_nonce !~ '^[A-Za-z0-9+/]{16}$' or p_auth_tag !~ '^[A-Za-z0-9+/]{22}==$' then raise exception 'FORBIDDEN'; end if;
 insert into public.participant_auth_mail_payloads(job_id,application_id,nonce,ciphertext,auth_tag,expires_at)
 values(j.id,a.id,p_nonce,p_ciphertext,p_auth_tag,p_expires_at) on conflict(job_id) do nothing;
 return found;
end; $$;
revoke all on function public.store_participant_auth_mail(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.store_participant_auth_mail(uuid,uuid,text,text,text,timestamptz) to service_role;

-- Old first-entry RPC is no longer the staff scanner endpoint.
revoke all on function public.check_in_code(text,uuid) from public,anon,authenticated;
-- Browser users may invoke only explicitly granted business RPCs.
revoke all on function public.accept_application(uuid,uuid,integer),public.begin_payment_submission(uuid,text,integer),
public.approve_payment(uuid,text,integer,timestamptz,integer,uuid),public.redeem_meal(text,uuid,uuid),public.revoke_participation(uuid,text,boolean) from public,anon;

create or replace function public.cancel_application(p_application_id uuid)
returns boolean language sql security definer set search_path='' as $$
 select public.revoke_participation(p_application_id,'Yönetici panelinden iptal',true);
$$;

create function public.retry_participant_invite(p_job_id uuid,p_email text)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype; j public.mail_jobs%rowtype; v_email text:=lower(btrim(p_email));
begin
 select a0.* into a from public.applications a0 join public.mail_jobs j0 on j0.application_id=a0.id where j0.id=p_job_id for update of a0;
 if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN'; end if;
 select * into j from public.mail_jobs where id=p_job_id for update;
 if j.kind<>'acceptance' or j.status<>'failed' or a.status<>'accepted_pending_payment'
 or exists(select 1 from public.participant_memberships where application_id=a.id) then return false; end if;
 if v_email is null or length(v_email) not between 3 and 254 or v_email !~ '^[^ @]+@[^ @]+\.[^ @]+$' then raise exception 'INVALID_EMAIL'; end if;
 update public.applications set email=v_email,version=version+1,updated_at=now() where id=a.id;
 update public.participant_invites set email=v_email,status='queued',auth_user_id=null,updated_at=now() where application_id=a.id;
 update public.mail_jobs set recipient_email=v_email,approval_version=a.version+1,status='queued',delivery_status='unknown',
 provider_message_id=null,last_error=null,next_attempt_at=now(),idempotency_key=gen_random_uuid(),updated_at=now() where id=j.id;
 insert into public.audit_logs(actor_id,action,target_id) values(auth.uid(),'participant_invite_retry',a.id);
 return true;
end; $$;
revoke all on function public.retry_participant_invite(uuid,text) from public,anon;
grant execute on function public.retry_participant_invite(uuid,text) to authenticated;
create or replace function public.record_mail_event(
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
    status = case when p_event = 'invalid_email' and status <> 'sent' then 'failed' else status end,
    updated_at = now() where id = v_job.id;
  update public.mail_events set processed = true where fingerprint = p_fingerprint;
  return true;
end;
$$;
revoke all on function public.record_mail_event(text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_mail_event(text, text, text, text, text, timestamptz) to service_role;

create or replace function public.queue_approval_batch(p_batch_id uuid, p_actor uuid, p_jobs jsonb, p_request_hash text)
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
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
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
      committee_name, subject, html_content, text_content, tag, kind
    ) values (
      v_job_id, p_batch_id, v_app.id, v_app.version + 1, v_app.email,
      v_app.first_name || ' ' || v_app.last_name, v_committee.name,
      v_job->>'subject', v_job->>'html', v_job->>'text', 'aero-job-' || v_job_id::text, 'acceptance'
    );
    update public.applications set status='accepted_pending_payment',committee_id=v_committee.id,
      payment_amount_minor=(select payment_amount_minor from public.events where id=v_event),
      payment_currency=(select payment_currency from public.events where id=v_event),
      payment_iban=(select payment_iban from public.events where id=v_event),
      payment_deadline=(select payment_deadline from public.events where id=v_event),
      version=version+1,updated_at=now() where id=v_app.id;
    insert into public.participant_invites(application_id,email) values(v_app.id,v_app.email) on conflict(application_id) do nothing;
  end loop;
  insert into public.audit_logs(actor_id, action, target_id, summary)
    values (p_actor, 'batch_created', p_batch_id, jsonb_build_object('count', jsonb_array_length(p_jobs)));
  return p_batch_id;
end;
$$;
revoke all on function public.queue_approval_batch(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.queue_approval_batch(uuid, uuid, jsonb, text) to service_role;




-- Business RPCs created above are called only by authenticated roles.
-- A button-triggered send claims its own batch first. The regular cron worker
-- keeps the original global claim function for recovery and quota retries.
create or replace function public.claim_batch_mail_jobs(p_worker uuid,p_batch_id uuid,p_limit integer)
returns setof public.mail_jobs language plpgsql security definer set search_path='' as $$
declare v_state public.mail_provider_state%rowtype; v_date date:=(now() at time zone 'Europe/Istanbul')::date;
 v_slots integer; v_id uuid; v_count integer:=0;
begin
 if p_batch_id is null or p_worker is null or p_limit is null or p_limit not between 1 and 20
 then raise exception 'INVALID_CLAIM'; end if;
 update public.mail_jobs set status='uncertain',lease_owner=null,lease_until=null,
 last_error='İşleyici yanıtı kayboldu; sağlayıcı olayı araştırılmalı.',updated_at=now()
 where status='sending' and lease_until<now();
 select * into v_state from public.mail_provider_state where id=1 for update;
 if v_state.sent_day is distinct from v_date then
  update public.mail_provider_state set sent_day=v_date,reserved_today=0 where id=1;
  v_state.reserved_today:=0;
 end if;
 v_slots:=greatest(0,v_state.approval_budget-v_state.reserved_today);
 if v_state.send_blocked_until is not null and v_state.send_blocked_until>now() then v_slots:=0; end if;
 if v_state.provider_remaining is not null then
  v_slots:=least(v_slots,greatest(0,v_state.provider_remaining-v_state.auth_reserve));
 end if;
 v_slots:=least(v_slots,p_limit);
 for v_id in select id from public.mail_jobs where batch_id=p_batch_id
  and status in('queued','quota_wait') and next_attempt_at<=now()
  order by created_at,id for update skip locked limit v_slots
 loop
  update public.mail_jobs set status='sending',lease_owner=p_worker,lease_until=now()+interval '2 minutes',
   first_send_at=coalesce(first_send_at,now()),reservation_day=v_date,attempts=attempts+1,updated_at=now() where id=v_id;
  v_count:=v_count+1;
  return query select * from public.mail_jobs where id=v_id;
 end loop;
 update public.mail_provider_state set reserved_today=reserved_today+v_count,
  provider_remaining=case when provider_remaining is null then null else greatest(0,provider_remaining-v_count) end,
  worker_heartbeat_at=now() where id=1;
 if v_slots=0 then
  update public.mail_jobs set status='quota_wait',updated_at=now()
   where batch_id=p_batch_id and status='queued' and next_attempt_at<=now();
 end if;
end; $$;
revoke all on function public.claim_batch_mail_jobs(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_batch_mail_jobs(uuid,uuid,integer) to service_role;

-- Join before pagination so an old application never hides a newer receipt.
create index payment_submissions_review_order_idx on public.payment_submissions(created_at desc,id desc)
where status in ('under_review','approved','correction_required');
create function public.list_payment_reviews(p_event_id uuid,p_page integer,p_page_size integer)
returns table(id uuid,application_id uuid,version integer,status text,review_reason text,created_at timestamptz,application jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_page is null or p_page not between 0 and 10000 or p_page_size is null or p_page_size not between 1 and 100
 then raise exception 'INVALID_PAGE'; end if;
 if not private.staff_for_event(p_event_id,true) then raise exception 'FORBIDDEN'; end if;
 return query
 select s.id,s.application_id,s.version,s.status,s.review_reason,s.created_at,
 jsonb_build_object('id',a.id,'first_name',a.first_name,'last_name',a.last_name,'email',a.email,
 'payment_amount_minor',a.payment_amount_minor,'payment_currency',a.payment_currency,'status',a.status)
 from public.payment_submissions s join public.applications a on a.id=s.application_id
 where a.event_id=p_event_id and s.status in('under_review','approved','correction_required')
 order by s.created_at desc,s.id desc limit p_page_size+1 offset p_page*p_page_size;
end; $$;
revoke all on function public.list_payment_reviews(uuid,integer,integer) from public,anon;
grant execute on function public.list_payment_reviews(uuid,integer,integer) to authenticated;

revoke all on function public.accept_application(uuid,uuid,integer),public.begin_payment_submission(uuid,text,integer),
public.approve_payment(uuid,text,integer,timestamptz,integer,uuid),public.redeem_meal(text,uuid,uuid),public.revoke_participation(uuid,text,boolean),
public.rotate_qr(uuid),public.cancel_application(uuid) from public,anon;
grant execute on function public.accept_application(uuid,uuid,integer),public.begin_payment_submission(uuid,text,integer),
public.approve_payment(uuid,text,integer,timestamptz,integer,uuid),public.redeem_meal(text,uuid,uuid),public.revoke_participation(uuid,text,boolean),
public.rotate_qr(uuid),public.cancel_application(uuid) to authenticated;

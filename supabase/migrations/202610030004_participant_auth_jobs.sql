-- Auth requests reserve a durable job BEFORE generating any Supabase token.
drop index public.mail_jobs_application_kind_version_key;
create unique index mail_jobs_business_kind_version_key on public.mail_jobs(application_id,kind,approval_version) where kind<>'participant_auth';
alter table public.mail_jobs add column auth_purpose text;
alter table public.mail_jobs add column auth_request_id uuid unique;
alter table public.mail_jobs add column auth_prepare_state text not null default 'unprepared' check(auth_prepare_state in('unprepared','preparing','prepared','expired'));
alter table public.participant_auth_mail_payloads add column auth_user_id uuid references auth.users(id);
alter table public.participant_auth_mail_payloads add column auth_type text;
alter table public.participant_auth_mail_payloads add column token_fingerprint text;
alter table public.participant_auth_link_limits drop constraint participant_auth_link_limits_pkey;
alter table public.participant_auth_link_limits add primary key(key_hash,purpose);

create table public.participant_auth_attempts(ip_hash text not null,purpose text not null check(purpose in('login','activation')),window_started_at timestamptz not null default now(),failures integer not null default 0,primary key(ip_hash,purpose));
alter table public.participant_auth_attempts enable row level security;
revoke all on public.participant_auth_attempts from public,anon,authenticated;

create function public.check_participant_auth_attempt(p_ip_hash text,p_purpose text)
returns table(allowed boolean,wait_seconds integer) language plpgsql security definer set search_path='' as $$
declare r public.participant_auth_attempts%rowtype;
begin
 if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' or p_purpose not in('login','activation') then raise exception 'INVALID_REQUEST';end if;
 select * into r from public.participant_auth_attempts where ip_hash=p_ip_hash and purpose=p_purpose;
 return query select not(found and r.failures>=10 and r.window_started_at>now()-interval '10 minutes'),
 case when found and r.failures>=10 then greatest(1,ceil(extract(epoch from(r.window_started_at+interval '10 minutes'-now())))::integer) else 0 end;
end;$$;
create function public.record_participant_auth_attempt(p_ip_hash text,p_purpose text,p_success boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' or p_purpose not in('login','activation') or p_success is null then raise exception 'INVALID_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended('auth-attempt:'||p_ip_hash||':'||p_purpose,0));
 if p_success then delete from public.participant_auth_attempts where ip_hash=p_ip_hash and purpose=p_purpose;return;end if;
 insert into public.participant_auth_attempts(ip_hash,purpose,failures) values(p_ip_hash,p_purpose,1)
 on conflict(ip_hash,purpose) do update set
 failures=case when participant_auth_attempts.window_started_at<=now()-interval '10 minutes' then 1 else participant_auth_attempts.failures+1 end,
 window_started_at=case when participant_auth_attempts.window_started_at<=now()-interval '10 minutes' then now() else participant_auth_attempts.window_started_at end;
end;$$;

create or replace function public.reserve_participant_auth_link(p_email_hash text,p_ip_hash text,p_purpose text,p_now timestamptz default now())
returns table(allowed boolean,wait_seconds integer) language plpgsql security definer set search_path='' as $$
declare e public.participant_auth_link_limits%rowtype;i public.participant_auth_link_limits%rowtype;
begin
 if p_email_hash is null or p_ip_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' or p_ip_hash !~ '^[0-9a-f]{64}$' or p_purpose not in('activate','recovery','invite') then raise exception 'INVALID_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended('auth-link-ip:'||p_ip_hash,0));
 perform pg_advisory_xact_lock(hashtextextended('auth-link-email:'||p_email_hash||':'||p_purpose,0));
 select * into e from public.participant_auth_link_limits where key_hash=p_email_hash and purpose=p_purpose for update;
 if found and e.last_requested_at>p_now-interval '60 seconds' then return query select false,greatest(1,ceil(extract(epoch from(e.last_requested_at+interval '60 seconds'-p_now)))::integer);return;end if;
 if e.window_started_at>p_now-interval '1 hour' and e.request_count>=3 then return query select false,greatest(1,ceil(extract(epoch from(e.window_started_at+interval '1 hour'-p_now)))::integer);return;end if;
 select * into i from public.participant_auth_link_limits where key_hash=p_ip_hash and purpose='ip' for update;
 if found and i.window_started_at>p_now-interval '1 hour' and i.request_count>=20 then return query select false,greatest(1,ceil(extract(epoch from(i.window_started_at+interval '1 hour'-p_now)))::integer);return;end if;
 insert into public.participant_auth_link_limits(key_hash,purpose,window_started_at,last_requested_at,request_count)
 values(p_email_hash,p_purpose,p_now,p_now,1) on conflict(key_hash,purpose) do update set
 request_count=case when participant_auth_link_limits.window_started_at<=p_now-interval '1 hour' then 1 else participant_auth_link_limits.request_count+1 end,
 window_started_at=case when participant_auth_link_limits.window_started_at<=p_now-interval '1 hour' then p_now else participant_auth_link_limits.window_started_at end,last_requested_at=p_now;
 insert into public.participant_auth_link_limits(key_hash,purpose,window_started_at,last_requested_at,request_count)
 values(p_ip_hash,'ip',p_now,p_now,1) on conflict(key_hash,purpose) do update set
 request_count=case when participant_auth_link_limits.window_started_at<=p_now-interval '1 hour' then 1 else participant_auth_link_limits.request_count+1 end,
 window_started_at=case when participant_auth_link_limits.window_started_at<=p_now-interval '1 hour' then p_now else participant_auth_link_limits.window_started_at end,last_requested_at=p_now;
 return query select true,0;
end;$$;

create function public.request_participant_auth_mail(p_email text,p_purpose text,p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;e public.events%rowtype;i public.participant_invites%rowtype;b uuid;j uuid;actor uuid;n integer;
begin
 if p_email is null or p_purpose not in('activate','recovery') or p_request_id is null then raise exception 'INVALID_REQUEST';end if;
 perform pg_advisory_xact_lock(hashtextextended('auth-request:'||lower(btrim(p_email)),0));
 select count(*) into n from public.applications x join public.participant_invites v on v.application_id=x.id where x.email=lower(btrim(p_email)) and x.status in('accepted_pending_payment','confirmed') and v.status<>'revoked';
 if n<>1 then return null;end if;
 select x.* into a from public.applications x join public.participant_invites v on v.application_id=x.id where x.email=lower(btrim(p_email)) and x.status in('accepted_pending_payment','confirmed') and v.status<>'revoked' for update of x;
 select * into i from public.participant_invites where application_id=a.id for update;
 select * into e from public.events where id=a.event_id;
 if e.participant_portal_url is null or e.participant_portal_url !~ '^https://[^ /?#]+/katilimci$' then raise exception 'PORTAL_NOT_CONFIGURED';end if;
 select id into actor from auth.users where lower(email)=a.email;
 -- A technical invited user without confirmation still needs activation, not recovery.
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then p_purpose:='activate';end if;
 select batch_id into b from public.mail_jobs where auth_request_id=p_request_id and application_id=a.id;
 if b is not null then return b;end if;
 select batch_id into b from public.mail_jobs where application_id=a.id and kind in('acceptance','participant_auth') and status in('queued','sending','uncertain','quota_wait') order by created_at limit 1;
 if b is not null then return b;end if;
 b:=gen_random_uuid();j:=gen_random_uuid();
 -- mail_batches requires a creator; the accepting admin remains the audit actor.
 select created_by into actor from public.mail_batches where event_id=a.event_id order by created_at desc limit 1;
 if actor is null then select user_id into actor from public.staff_members where event_id=a.event_id and role='admin' and active limit 1;end if;
 if actor is null then raise exception 'FORBIDDEN';end if;
 insert into public.mail_batches(id,event_id,created_by,request_hash,total) values(b,a.event_id,actor,encode(extensions.digest(j::text,'sha256'),'hex'),1);
 insert into public.mail_jobs(id,batch_id,application_id,approval_version,recipient_email,recipient_name,committee_name,subject,html_content,text_content,tag,kind,auth_purpose,auth_request_id)
 values(j,b,a.id,a.version,a.email,a.first_name||' '||a.last_name,coalesce((select name from public.committees where id=a.committee_id),''),'AERO Sirkülasyon Çalıştayı — Hesap bağlantınız','<p>AERO hesabınız için güvenli bağlantı.</p>','AERO hesabınız için güvenli bağlantı.','aero-auth-'||j::text,'participant_auth',p_purpose,p_request_id);
 return b;
end;$$;

create function public.begin_participant_auth_preparation(p_job_id uuid)
returns table(application_id uuid,recipient_email text,portal_url text,auth_user_id uuid,email_confirmed boolean,purpose text)
language plpgsql security definer set search_path='' as $$
declare j public.mail_jobs%rowtype;a public.applications%rowtype;i public.participant_invites%rowtype;e public.events%rowtype;u auth.users%rowtype;
begin
 select * into j from public.mail_jobs where id=p_job_id for update;
 if not found or j.kind not in('acceptance','participant_auth') or j.status<>'sending' or j.auth_prepare_state<>'unprepared' then raise exception 'AUTH_PREPARATION_NOT_SAFE';end if;
 select * into a from public.applications where id=j.application_id for update;
 if not found or a.status not in('accepted_pending_payment','confirmed') or a.email<>j.recipient_email then raise exception 'APPLICATION_INACTIVE';end if;
 select * into i from public.participant_invites where participant_invites.application_id=a.id for update;
 if not found or i.status='revoked' or i.email<>a.email then raise exception 'FORBIDDEN';end if;
 select * into e from public.events where id=a.event_id;
 if e.participant_portal_url is null or e.participant_portal_url !~ '^https://[^ /?#]+/katilimci$' then raise exception 'PORTAL_NOT_CONFIGURED';end if;
 if exists(select 1 from public.participant_auth_mail_payloads where job_id=j.id) then raise exception 'AUTH_PREPARATION_NOT_SAFE';end if;
 select * into u from auth.users where lower(email)=a.email;
 if i.auth_user_id is not null and i.auth_user_id is distinct from u.id then raise exception 'FORBIDDEN';end if;
 update public.mail_jobs set auth_prepare_state='preparing' where id=j.id;
 return query select a.id,a.email,e.participant_portal_url,u.id,u.email_confirmed_at is not null,coalesce(j.auth_purpose,'activate');
end;$$;

create function public.store_bound_participant_auth_mail(p_job_id uuid,p_application_id uuid,p_user_id uuid,p_type text,p_fingerprint text,p_nonce text,p_ciphertext text,p_auth_tag text,p_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare j public.mail_jobs%rowtype;a public.applications%rowtype;i public.participant_invites%rowtype;
begin
 select * into j from public.mail_jobs where id=p_job_id for update;
 select * into a from public.applications where id=p_application_id for update;
 select * into i from public.participant_invites where application_id=p_application_id for update;
 if j.id is null or a.id is null or i.id is null or j.application_id<>a.id or j.kind not in('acceptance','participant_auth') or j.status<>'sending' or j.auth_prepare_state<>'preparing' or a.status not in('accepted_pending_payment','confirmed') or i.status='revoked' or j.recipient_email<>a.email
 or p_type not in('invite','magiclink','recovery') or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '65 minutes'
 or p_nonce is null or p_nonce !~ '^[A-Za-z0-9+/]{16}$' or p_auth_tag is null or p_auth_tag !~ '^[A-Za-z0-9+/]{22}==$' or p_ciphertext is null or length(p_ciphertext)>16384
 or not exists(select 1 from auth.users where id=p_user_id and lower(email)=a.email) then raise exception 'FORBIDDEN';end if;
 insert into public.participant_auth_mail_payloads(job_id,application_id,auth_user_id,auth_type,token_fingerprint,nonce,ciphertext,auth_tag,expires_at) values(j.id,a.id,p_user_id,p_type,p_fingerprint,p_nonce,p_ciphertext,p_auth_tag,p_expires_at);
 update public.participant_invites set auth_user_id=p_user_id,expires_at=p_expires_at,updated_at=now() where id=i.id;
 update public.mail_jobs set auth_prepare_state='prepared' where id=j.id;
 return true;
end;$$;

drop function public.read_participant_auth_mail(uuid);
create function public.read_participant_auth_mail(p_job_id uuid)
returns table(job_id uuid,application_id uuid,nonce text,ciphertext text,auth_tag text,expires_at timestamptz,recipient_email text,auth_type text,token_fingerprint text)
language sql security definer set search_path='' as $$
 select p.job_id,p.application_id,p.nonce,p.ciphertext,p.auth_tag,p.expires_at,j.recipient_email,p.auth_type,p.token_fingerprint from public.participant_auth_mail_payloads p join public.mail_jobs j on j.id=p.job_id where p.job_id=p_job_id and j.kind in('participant_auth','acceptance');
$$;

create function public.validate_participant_activation(p_user_id uuid,p_job_id uuid,p_fingerprint text,p_type text)
returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.participant_auth_mail_payloads p join public.mail_jobs j on j.id=p.job_id join public.applications a on a.id=p.application_id join public.participant_invites i on i.application_id=a.id join auth.users u on u.id=p_user_id
 where p.job_id=p_job_id and p.token_fingerprint=p_fingerprint and p.auth_type=p_type and p.auth_user_id=p_user_id and p.expires_at>now() and j.auth_prepare_state='prepared' and a.status in('accepted_pending_payment','confirmed') and i.status<>'revoked' and i.auth_user_id=p_user_id and lower(u.email)=a.email and i.email=a.email and j.recipient_email=a.email and u.email_confirmed_at is not null
 and not exists(select 1 from public.participant_memberships m where m.user_id=p_user_id and m.application_id<>a.id));
$$;
create function public.validate_staff_activation(p_user_id uuid)
returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.staff_members s join public.events e on e.id=s.event_id join auth.users u on u.id=s.user_id where s.user_id=p_user_id and s.active and s.role in('admin','staff') and u.email_confirmed_at is not null);
$$;

create function public.cleanup_participant_auth_payloads()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.mail_jobs j set auth_prepare_state='expired' from public.participant_auth_mail_payloads p where p.job_id=j.id and p.expires_at<now()-interval '23 hours' and j.status in('sent','failed','cancelled');
 delete from public.participant_auth_mail_payloads p using public.mail_jobs j where p.job_id=j.id and p.expires_at<now()-interval '23 hours' and j.status in('sent','failed','cancelled');get diagnostics n=row_count;
 delete from public.participant_auth_attempts where window_started_at<now()-interval '1 day';
 delete from public.participant_auth_link_limits where last_requested_at<now()-interval '1 day';
 return n;
end;$$;

revoke all on function public.queue_participant_auth_mail(uuid,uuid,text,text,text,timestamptz),public.store_participant_auth_mail(uuid,uuid,text,text,text,timestamptz) from service_role;
revoke all on function public.check_participant_auth_attempt(text,text),public.record_participant_auth_attempt(text,text,boolean),public.request_participant_auth_mail(text,text,uuid),public.begin_participant_auth_preparation(uuid),public.store_bound_participant_auth_mail(uuid,uuid,uuid,text,text,text,text,text,timestamptz),public.read_participant_auth_mail(uuid),public.validate_participant_activation(uuid,uuid,text,text),public.validate_staff_activation(uuid),public.cleanup_participant_auth_payloads() from public,anon,authenticated;
grant execute on function public.check_participant_auth_attempt(text,text),public.record_participant_auth_attempt(text,text,boolean),public.request_participant_auth_mail(text,text,uuid),public.begin_participant_auth_preparation(uuid),public.store_bound_participant_auth_mail(uuid,uuid,uuid,text,text,text,text,text,timestamptz),public.read_participant_auth_mail(uuid),public.validate_participant_activation(uuid,uuid,text,text),public.validate_staff_activation(uuid),public.cleanup_participant_auth_payloads() to service_role;
-- Schedule installed separately only after live pg_cron/Vault baseline has been inspected.

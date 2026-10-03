-- Provider acceptance completes the send attempt; delivery events remain independent.
-- Expired credentials cannot be reused. Keep uncertain jobs and all provider/audit rows.
create or replace function public.cleanup_participant_auth_payloads()
returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 update public.mail_jobs j set auth_prepare_state='expired' from public.participant_auth_mail_payloads p where p.job_id=j.id and p.expires_at<now()-interval '23 hours' and j.status in('provider_accepted','sent','failed','cancelled');
 delete from public.participant_auth_mail_payloads p using public.mail_jobs j where p.job_id=j.id and p.expires_at<now()-interval '23 hours' and j.status in('provider_accepted','sent','failed','cancelled');get diagnostics n=row_count;
 delete from public.participant_auth_attempts where window_started_at<now()-interval '1 day';
 delete from public.participant_auth_link_limits where last_requested_at<now()-interval '1 day';
 return n;
end;$$;

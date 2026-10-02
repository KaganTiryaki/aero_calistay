create function public.claim_batch_mail_jobs(p_worker uuid,p_batch_id uuid,p_limit integer)
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

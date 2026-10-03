create function public.set_application_payment_amount(p_application_id uuid,p_expected_version integer,p_amount_minor integer,p_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare a public.applications%rowtype;
begin
 select * into a from public.applications where id=p_application_id for update;
 if not found or not private.staff_for_event(a.event_id,true) then raise exception 'FORBIDDEN';end if;
 if a.status<>'accepted_pending_payment' or exists(select 1 from public.payment_submissions where application_id=a.id and status='approved') then raise exception 'APPLICATION_INACTIVE';end if;
 if a.version is distinct from p_expected_version then raise exception 'STALE_APPLICATION';end if;
 if p_amount_minor is null or p_amount_minor<=0 then raise exception 'INVALID_PAYMENT';end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'INVALID_REASON';end if;
 update public.applications set payment_amount_minor=p_amount_minor,version=version+1,updated_at=now() where id=a.id;
 insert into public.audit_logs(actor_id,action,target_id,summary) values(auth.uid(),'payment_amount_set',a.id,jsonb_build_object('before',a.payment_amount_minor,'after',p_amount_minor,'reason',btrim(p_reason),'applicationVersion',a.version));
 return true;
end;$$;
revoke all on function public.set_application_payment_amount(uuid,integer,integer,text) from public,anon;
grant execute on function public.set_application_payment_amount(uuid,integer,integer,text) to authenticated;

create or replace function public.list_payment_reviews(p_event_id uuid,p_page integer,p_page_size integer)
returns table(id uuid,application_id uuid,version integer,status text,review_reason text,created_at timestamptz,application jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_page is null or p_page not between 0 and 10000 or p_page_size is null or p_page_size not between 1 and 100 then raise exception 'INVALID_PAGE';end if;
 if not private.staff_for_event(p_event_id,true) then raise exception 'FORBIDDEN';end if;
 return query select s.id,s.application_id,s.version,s.status,s.review_reason,s.created_at,
 jsonb_build_object('id',a.id,'version',a.version,'first_name',a.first_name,'last_name',a.last_name,'email',a.email,'payment_amount_minor',a.payment_amount_minor,'payment_currency',a.payment_currency,'status',a.status)
 from public.payment_submissions s join public.applications a on a.id=s.application_id where a.event_id=p_event_id and s.status in('under_review','approved','correction_required') order by s.created_at desc,s.id desc limit p_page_size+1 offset p_page*p_page_size;
end;$$;

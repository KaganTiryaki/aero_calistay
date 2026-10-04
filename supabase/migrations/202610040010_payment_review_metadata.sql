-- A status-specific RPC filters before pagination and includes the application version.
create function public.list_payment_reviews_by_status(p_event_id uuid,p_page integer,p_page_size integer,p_status text)
returns table(id uuid,application_id uuid,version integer,status text,review_reason text,created_at timestamptz,application jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_page is null or p_page not between 0 and 10000 or p_page_size is null or p_page_size not between 1 and 100
    or p_status is null or p_status not in ('under_review','approved','correction_required')
 then raise exception 'INVALID_PAGE'; end if;
 if not private.staff_for_event(p_event_id,true) then raise exception 'FORBIDDEN'; end if;
 return query
 select s.id,s.application_id,s.version,s.status,s.review_reason,s.created_at,
 jsonb_build_object('id',a.id,'version',a.version,'first_name',a.first_name,'last_name',a.last_name,'email',a.email,
 'committee_name',c.name,'payment_amount_minor',a.payment_amount_minor,'payment_currency',a.payment_currency,'status',a.status)
 from public.payment_submissions s join public.applications a on a.id=s.application_id
 left join public.committees c on c.id=a.committee_id and c.event_id=p_event_id
 where a.event_id=p_event_id and s.status=p_status
 order by s.created_at desc,s.id desc
 limit p_page_size+1 offset p_page*p_page_size;
end; $$;
revoke all on function public.list_payment_reviews_by_status(uuid,integer,integer,text) from public,anon;
grant execute on function public.list_payment_reviews_by_status(uuid,integer,integer,text) to authenticated;

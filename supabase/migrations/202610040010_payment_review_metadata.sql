-- Keep the existing RPC result columns stable; enrich only its application JSON.
create or replace function public.list_payment_reviews(p_event_id uuid,p_page integer,p_page_size integer)
returns table(id uuid,application_id uuid,version integer,status text,review_reason text,created_at timestamptz,application jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_page is null or p_page not between 0 and 10000 or p_page_size is null or p_page_size not between 1 and 100
 then raise exception 'INVALID_PAGE'; end if;
 if not private.staff_for_event(p_event_id,true) then raise exception 'FORBIDDEN'; end if;
 return query
 select s.id,s.application_id,s.version,s.status,s.review_reason,s.created_at,
 jsonb_build_object('id',a.id,'version',a.version,'first_name',a.first_name,'last_name',a.last_name,'email',a.email,
 'committee_name',c.name,'payment_amount_minor',a.payment_amount_minor,'payment_currency',a.payment_currency,'status',a.status)
 from public.payment_submissions s join public.applications a on a.id=s.application_id
 left join public.committees c on c.id=a.committee_id and c.event_id=p_event_id
 where a.event_id=p_event_id and s.status in('under_review','approved','correction_required')
 order by case when s.status='under_review' then 0 else 1 end,s.created_at desc,s.id desc
 limit p_page_size+1 offset p_page*p_page_size;
end; $$;
revoke all on function public.list_payment_reviews(uuid,integer,integer) from public,anon;
grant execute on function public.list_payment_reviews(uuid,integer,integer) to authenticated;

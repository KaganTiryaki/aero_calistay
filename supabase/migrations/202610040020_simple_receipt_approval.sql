-- A panel action records receipt acceptance without asserting that a bank
-- transaction was independently verified.
alter table public.payment_reviews add column review_source text not null default 'bank'
  check (review_source in ('bank','receipt'));

create function public.approve_payment_receipt(
  p_submission_id uuid,
  p_expected_version integer,
  p_request_id uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_amount integer; v_event uuid; v_review public.payment_reviews%rowtype;
begin
  -- Serialize repeated attempts in the same order as the underlying approval.
  select a.payment_amount_minor,a.event_id into v_amount,v_event
  from public.applications a
  join public.payment_submissions s on s.application_id=a.id
  where s.id=p_submission_id for update of a;

  if not found or not private.staff_for_event(v_event,true) then raise exception 'FORBIDDEN'; end if;
  select * into v_review from public.payment_reviews
  where request_id=p_request_id or submission_id=p_submission_id;
  if found then
    if v_review.request_id=p_request_id and v_review.submission_id=p_submission_id
      and v_review.review_source='receipt' and v_review.decision='approved' then return true; end if;
    raise exception 'REQUEST_CONFLICT';
  end if;

  if v_amount is null or v_amount<=0 then raise exception 'PAYMENT_NOT_CONFIGURED'; end if;

  perform public.approve_payment(
    p_submission_id,
    'receipt-' || p_submission_id::text,
    v_amount,
    now(),
    p_expected_version,
    p_request_id
  );
  update public.payment_reviews set bank_reference=null,amount_minor=null,
    transaction_at=null,review_source='receipt'
  where submission_id=p_submission_id and request_id=p_request_id;
  return true;
end; $$;

revoke all on function public.approve_payment_receipt(uuid,integer,uuid) from public,anon;
grant execute on function public.approve_payment_receipt(uuid,integer,uuid) to authenticated;

-- A panel action deliberately records that an administrator accepted the uploaded receipt.
-- The expected application amount remains the authoritative amount; staff no longer enter
-- transaction metadata in the panel for this workflow.
create function public.approve_payment_receipt(
  p_submission_id uuid,
  p_expected_version integer,
  p_request_id uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_amount integer;
begin
  select a.payment_amount_minor into v_amount
  from public.applications a
  join public.payment_submissions s on s.application_id=a.id
  where s.id=p_submission_id;

  if v_amount is null or v_amount<=0 then raise exception 'PAYMENT_NOT_CONFIGURED'; end if;

  return public.approve_payment(
    p_submission_id,
    'receipt-' || p_submission_id::text,
    v_amount,
    now(),
    p_expected_version,
    p_request_id
  );
end; $$;

revoke all on function public.approve_payment_receipt(uuid,integer,uuid) from public,anon;
grant execute on function public.approve_payment_receipt(uuid,integer,uuid) to authenticated;

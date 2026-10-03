-- Participant acceptance, payment review, and meal redemption vertical slice.
alter type public.application_status add value if not exists 'accepted_pending_payment';
alter type public.application_status add value if not exists 'confirmed';

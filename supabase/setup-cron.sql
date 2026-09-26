-- Run once in the dedicated Supabase project after these Vault secrets exist:
--   aero_project_url: https://<project-ref>.supabase.co
--   aero_mail_queue_secret: the same random value as MAIL_QUEUE_SECRET
-- Example (supply values privately in the SQL editor; never commit them):
--   select vault.create_secret('<project-url>', 'aero_project_url');
--   select vault.create_secret('<random-secret>', 'aero_mail_queue_secret');
-- The function uses verify_jwt=false and authenticates this secret itself.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'aero-process-mail-queue',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'aero_project_url') || '/functions/v1/process-mail-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'aero_mail_queue_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

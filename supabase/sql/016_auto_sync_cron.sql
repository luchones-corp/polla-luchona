-- Automatic fixture sync via pg_cron + pg_net
-- Calls the sync-fixtures Edge Function every 5 minutes.
--
-- Prerequisites: enable pg_cron and pg_net extensions in
-- Supabase Dashboard → Database → Extensions (if not already enabled).

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule: every 5 minutes
SELECT cron.schedule(
  'sync-fixtures-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wwacncltofuvixdpdydm.supabase.co/functions/v1/sync-fixtures',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

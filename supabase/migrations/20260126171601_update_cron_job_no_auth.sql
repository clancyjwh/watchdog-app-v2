/*
  # Update Cron Job to Call Edge Function Without Auth

  ## Overview
  Updates the cron job to call the edge function without authentication since verify_jwt is disabled.
  
  ## Changes
  
  1. Cron Job Update
    - Removes authentication requirement
    - Calls run-scheduled-scans edge function directly
    - Runs every 6 hours to check for companies due for automated scans
*/

-- Remove existing cron job
SELECT cron.unschedule('run-scheduled-scans') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'run-scheduled-scans'
);

-- Create cron job without auth header (edge function has verify_jwt=false)
SELECT cron.schedule(
  'run-scheduled-scans',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zwfefnobrbeaysdhpmih.supabase.co/functions/v1/run-scheduled-scans',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) AS request_id;
  $$
);

-- Verify the cron job was created
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count
  FROM cron.job
  WHERE jobname = 'run-scheduled-scans';
  
  IF job_count = 0 THEN
    RAISE EXCEPTION 'Failed to create cron job';
  ELSE
    RAISE NOTICE 'Cron job "run-scheduled-scans" created successfully. Runs every 6 hours.';
  END IF;
END $$;
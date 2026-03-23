/*
  # Setup Automated Scan Cron Job

  ## Overview
  Configures automated scheduled scanning using pg_cron extension.
  
  ## Changes
  
  1. Extensions
    - Enable pg_cron extension for scheduled tasks
    - Enable pg_net extension for HTTP requests
  
  2. Cron Job
    - Creates a cron job that runs every 6 hours
    - Calls the run-scheduled-scans edge function
    - Checks for companies due for automated scans based on subscription_frequency
    - Automatically processes: weekly (every 7 days), biweekly (every 14 days), monthly (every 30 days)
  
  3. Schedule
    - Runs at: 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM UTC daily
    - Frequency ensures all companies are checked regularly without delays
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions to execute HTTP requests
GRANT USAGE ON SCHEMA net TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA net TO postgres;

-- Remove existing cron job if it exists
SELECT cron.unschedule('run-scheduled-scans') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'run-scheduled-scans'
);

-- Create cron job to run scheduled scans every 6 hours
SELECT cron.schedule(
  'run-scheduled-scans',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zwfefnobrbeaysdhpmih.supabase.co/functions/v1/run-scheduled-scans',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Create a function to check cron job status
CREATE OR REPLACE FUNCTION get_cron_job_status()
RETURNS TABLE(
  jobname text,
  schedule text,
  active boolean,
  last_run timestamptz,
  next_run timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobname::text,
    j.schedule::text,
    j.active,
    r.start_time AS last_run,
    cron.schedule_to_timestamp(j.schedule, now()) AS next_run
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) r ON true
  WHERE j.jobname = 'run-scheduled-scans';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
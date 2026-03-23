/*
  # Add Last Automated Scan Tracking

  ## Overview
  Adds tracking for automated scheduled scans to enable weekly/biweekly/monthly automatic scanning.

  ## Changes
  
  1. New Columns
    - `companies.last_automated_scan_date` (timestamptz) - Tracks when the last automated scan was run
    - `companies.next_scan_due_date` (timestamptz) - Calculated field for when next scan is due
  
  2. Purpose
    - Enable automated cron-based scanning based on subscription_frequency
    - Track scan history to prevent duplicate scans
    - Calculate when next scan should run based on frequency settings
*/

-- Add last_automated_scan_date to companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'last_automated_scan_date'
  ) THEN
    ALTER TABLE companies ADD COLUMN last_automated_scan_date timestamptz;
  END IF;
END $$;

-- Add next_scan_due_date to companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'next_scan_due_date'
  ) THEN
    ALTER TABLE companies ADD COLUMN next_scan_due_date timestamptz;
  END IF;
END $$;

-- Create function to calculate next scan due date based on frequency
CREATE OR REPLACE FUNCTION calculate_next_scan_date(
  last_scan timestamptz,
  frequency text
) RETURNS timestamptz AS $$
BEGIN
  IF last_scan IS NULL THEN
    RETURN now();
  END IF;
  
  CASE frequency
    WHEN 'weekly' THEN
      RETURN last_scan + interval '7 days';
    WHEN 'biweekly' THEN
      RETURN last_scan + interval '14 days';
    WHEN 'monthly' THEN
      RETURN last_scan + interval '30 days';
    ELSE
      RETURN last_scan + interval '30 days';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update next_scan_due_date when last_automated_scan_date changes
CREATE OR REPLACE FUNCTION update_next_scan_due_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_scan_due_date := calculate_next_scan_date(
    NEW.last_automated_scan_date,
    NEW.subscription_frequency
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_next_scan_due_date'
  ) THEN
    CREATE TRIGGER trigger_update_next_scan_due_date
      BEFORE INSERT OR UPDATE OF last_automated_scan_date, subscription_frequency
      ON companies
      FOR EACH ROW
      EXECUTE FUNCTION update_next_scan_due_date();
  END IF;
END $$;

-- Initialize next_scan_due_date for existing companies
UPDATE companies
SET next_scan_due_date = calculate_next_scan_date(last_automated_scan_date, subscription_frequency)
WHERE next_scan_due_date IS NULL;
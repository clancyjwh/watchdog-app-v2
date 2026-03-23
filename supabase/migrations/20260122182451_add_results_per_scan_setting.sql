/*
  # Add results per scan setting

  1. Changes
    - Add `results_per_scan` column to profiles table (default: 10)
    - Add `results_per_scan` column to subscriptions table (default: 10)
  
  2. Notes
    - Allows users to specify how many results they want per scan (5, 10, 20, 50)
    - Helps control API costs and result quality
*/

-- Add results_per_scan to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'results_per_scan'
  ) THEN
    ALTER TABLE profiles ADD COLUMN results_per_scan integer DEFAULT 10;
  END IF;
END $$;

-- Add results_per_scan to subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'results_per_scan'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN results_per_scan integer DEFAULT 10;
  END IF;
END $$;
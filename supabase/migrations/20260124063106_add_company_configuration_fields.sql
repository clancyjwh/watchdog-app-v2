/*
  # Add Company Configuration Fields

  1. Schema Changes
    - Add configuration fields to companies table:
      - `content_types` (text[], array of content type IDs)
      - `analysis_depth` (text, 'standard' or 'deep')
      - `results_per_scan` (integer, number of results per scan)
      - `subscription_frequency` (text, 'monthly', 'weekly', or 'daily')

  2. Notes
    - These fields allow each company to have its own monitoring configuration
    - Default values are set to match standard settings from onboarding
*/

-- Add content_types column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'content_types'
  ) THEN
    ALTER TABLE companies ADD COLUMN content_types text[] DEFAULT ARRAY['news', 'legislation', 'government'];
  END IF;
END $$;

-- Add analysis_depth column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'analysis_depth'
  ) THEN
    ALTER TABLE companies ADD COLUMN analysis_depth text DEFAULT 'standard';
  END IF;
END $$;

-- Add results_per_scan column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'results_per_scan'
  ) THEN
    ALTER TABLE companies ADD COLUMN results_per_scan integer DEFAULT 10;
  END IF;
END $$;

-- Add subscription_frequency column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'subscription_frequency'
  ) THEN
    ALTER TABLE companies ADD COLUMN subscription_frequency text DEFAULT 'monthly';
  END IF;
END $$;

-- Migrate existing data from profiles to companies (only migrate fields that exist in profiles)
UPDATE companies c
SET
  content_types = COALESCE(p.content_types, ARRAY['news', 'legislation', 'government']),
  analysis_depth = COALESCE(p.analysis_depth, 'standard'),
  results_per_scan = COALESCE(p.results_per_scan, 10)
FROM profiles p
WHERE c.user_id = p.user_id
AND c.content_types IS NULL;

-- Set subscription_frequency from subscriptions table if available
UPDATE companies c
SET subscription_frequency = s.frequency
FROM subscriptions s
WHERE s.company_id = c.id
AND c.subscription_frequency = 'monthly';
/*
  # Add Multi-Company Support

  1. New Tables
    - `companies` - Stores multiple companies per user
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text, company name)
      - `industry` (text, industry)
      - `description` (text, business description)
      - `monitoring_goals` (text, areas of interest)
      - `location_country` (text)
      - `location_province` (text)
      - `location_city` (text)
      - `business_context` (jsonb)
      - `created_at` (timestamptz)

  2. Schema Changes
    - Add `current_company_id` to profiles table
    - Add `company_id` to: sources, subscriptions, updates, topics, competitors, keywords, source_snapshots, research_history, source_ratings, scan_summaries

  3. Data Migration
    - Migrate existing company data from profiles to companies table
    - Set current_company_id for all existing users
    - Update all related tables with company_id from migrated data

  4. Security
    - Enable RLS on companies table
    - Add policies for authenticated users to manage their companies
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  industry text,
  description text,
  monitoring_goals text,
  location_country text,
  location_province text,
  location_city text,
  business_context jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add current_company_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'current_company_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN current_company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add company_id to all relevant tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE sources ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'updates' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE updates ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'topics' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE topics ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'competitors' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE competitors ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'keywords' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE keywords ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'source_snapshots' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE source_snapshots ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'research_history' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE research_history ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'source_ratings' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE source_ratings ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_summaries' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE scan_summaries ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrate existing data from profiles to companies
INSERT INTO companies (user_id, name, industry, description, monitoring_goals, location_country, location_province, location_city, business_context)
SELECT 
  p.user_id,
  p.company_name,
  p.industry,
  p.business_description,
  p.monitoring_goals,
  p.location_country,
  p.location_province,
  p.location_city,
  p.business_context
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM companies c WHERE c.user_id = p.user_id
)
AND p.company_name IS NOT NULL;

-- Update profiles with current_company_id
UPDATE profiles p
SET current_company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = p.user_id
  LIMIT 1
)
WHERE p.current_company_id IS NULL;

-- Update all related tables with company_id
UPDATE sources s
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = s.profile_id
  LIMIT 1
)
WHERE s.company_id IS NULL;

UPDATE subscriptions s
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = s.profile_id
  LIMIT 1
)
WHERE s.company_id IS NULL;

UPDATE updates u
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = u.profile_id
  LIMIT 1
)
WHERE u.company_id IS NULL;

UPDATE topics t
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = t.profile_id
  LIMIT 1
)
WHERE t.company_id IS NULL;

UPDATE competitors comp
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = comp.profile_id
  LIMIT 1
)
WHERE comp.company_id IS NULL;

UPDATE keywords k
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = k.profile_id
  LIMIT 1
)
WHERE k.company_id IS NULL;

UPDATE source_snapshots ss
SET company_id = (
  SELECT c.id
  FROM companies c
  JOIN sources s ON s.profile_id = c.user_id
  WHERE s.id = ss.source_id
  LIMIT 1
)
WHERE ss.company_id IS NULL;

UPDATE research_history rh
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = rh.profile_id
  LIMIT 1
)
WHERE rh.company_id IS NULL;

UPDATE source_ratings sr
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = sr.profile_id
  LIMIT 1
)
WHERE sr.company_id IS NULL;

UPDATE scan_summaries ss
SET company_id = (
  SELECT c.id
  FROM companies c
  WHERE c.user_id = ss.profile_id
  LIMIT 1
)
WHERE ss.company_id IS NULL;

-- Enable RLS on companies table
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies table
CREATE POLICY "Users can view own companies"
  ON companies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own companies"
  ON companies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
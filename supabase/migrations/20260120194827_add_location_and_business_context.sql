/*
  # Add Location and Business Context to Profiles

  ## Overview
  Adds optional geographic location and business context fields to support
  location-aware AI filtering and more targeted source recommendations.

  ## Changes

  1. **Profiles Table** - Add Location Fields (all optional)
     - `location_country` (text) - Country/region where business operates
     - `location_province` (text) - Province/state
     - `location_city` (text) - City or local area
     
  2. **Profiles Table** - Add Business Context (optional)
     - `business_context` (jsonb) - Array of business context tags
       Examples: ["non-profit", "b2b", "b2c", "startup", "enterprise", "regulated"]
     - `source_selection_method` (text) - How sources were chosen ("ai_auto", "manual")
     - `analysis_depth` (text) - Level of AI analysis ("standard", "deep")

  ## Notes
  - All fields are optional (NULL allowed)
  - Used by AI to filter geographically relevant sources
  - Used to calculate relevance scores based on location
  - Business context helps AI understand organizational type
*/

-- Add location fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_country'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_country text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_province'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_province text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_city'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_city text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_context'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_context jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'source_selection_method'
  ) THEN
    ALTER TABLE profiles ADD COLUMN source_selection_method text DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'analysis_depth'
  ) THEN
    ALTER TABLE profiles ADD COLUMN analysis_depth text DEFAULT 'standard';
  END IF;
END $$;

-- Add geographic_scope to sources table (used to identify local vs national vs global sources)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'geographic_scope'
  ) THEN
    ALTER TABLE sources ADD COLUMN geographic_scope text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'source_type'
  ) THEN
    ALTER TABLE sources ADD COLUMN source_type text DEFAULT 'core';
  END IF;
END $$;
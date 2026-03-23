/*
  # Add Core Source Flag

  1. Changes
    - Add `is_core_source` column to `sources` table
      - Indicates whether a source is a core/primary source that must be included in every update
      - Defaults to false for backward compatibility
  
  2. Purpose
    - Core sources are the primary sources users pay for and select during onboarding
    - These sources MUST be represented in every update delivery
    - Non-core sources can be used for supplementary content but are optional
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'is_core_source'
  ) THEN
    ALTER TABLE sources ADD COLUMN is_core_source boolean DEFAULT false;
  END IF;
END $$;
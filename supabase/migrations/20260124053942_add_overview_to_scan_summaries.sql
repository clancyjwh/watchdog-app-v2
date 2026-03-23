/*
  # Add overview field to scan_summaries table

  1. Changes
    - Add `overview` column to `scan_summaries` table to store one-sentence summary
  
  2. Details
    - Type: text (nullable to support existing records)
    - Purpose: Store a brief one-sentence overview of the scan results
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_summaries' AND column_name = 'overview'
  ) THEN
    ALTER TABLE scan_summaries ADD COLUMN overview text;
  END IF;
END $$;
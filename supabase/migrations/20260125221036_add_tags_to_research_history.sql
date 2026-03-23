/*
  # Add Tags to Research History

  1. Changes
    - Add `tags` column to `research_history` table
      - Stores array of tags (e.g., ["Competitor", "High Priority"])
      - Defaults to empty array
      - Allows filtering and categorizing research topics
  
  2. Purpose
    - Enable tagging of research topics for better organization
    - Support competitor-specific research tracking
    - Allow filtering research by category
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'research_history' AND column_name = 'tags'
  ) THEN
    ALTER TABLE research_history ADD COLUMN tags text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;
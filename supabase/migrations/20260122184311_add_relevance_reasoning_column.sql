/*
  # Add Relevance Reasoning Column

  1. Changes
    - Add `relevance_reasoning` column to `updates` table to store AI explanation for relevance score
  
  2. Details
    - Column type: text (nullable)
    - Stores natural language explanation of why an article received its relevance score
    - Used to display reasoning when user clicks on relevance badge
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'updates' AND column_name = 'relevance_reasoning'
  ) THEN
    ALTER TABLE updates ADD COLUMN relevance_reasoning text;
  END IF;
END $$;
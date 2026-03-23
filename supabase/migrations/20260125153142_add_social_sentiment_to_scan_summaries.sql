/*
  # Add social_sentiment to scan_summaries
  
  1. Changes
    - Add `social_sentiment` (text) column to `scan_summaries` table
    - This stores the 1-2 sentence social media sentiment summary from Grok
  
  2. Notes
    - Column is nullable since existing records won't have this data
    - New scans will populate this field with Grok's social sentiment analysis
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_summaries' AND column_name = 'social_sentiment'
  ) THEN
    ALTER TABLE scan_summaries ADD COLUMN social_sentiment text;
  END IF;
END $$;
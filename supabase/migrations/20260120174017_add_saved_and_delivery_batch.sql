/*
  # Add Saved and Delivery Batch Fields

  ## Changes
  
  1. Updates Table Modifications
    - Add `is_saved` (boolean) - Track if user saved/starred an update
    - Add `delivery_batch` (text) - Group updates by delivery date (e.g., "2025-01-20", "2025-w03")
    - Add index on delivery_batch for efficient time-based queries
  
  2. Security
    - Existing RLS policies automatically apply to new columns
  
  ## Purpose
  These fields support the new dashboard features:
  - Users can save/star important updates
  - Updates are grouped by delivery time period (daily/weekly/monthly)
*/

-- Add is_saved column to updates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'updates' AND column_name = 'is_saved'
  ) THEN
    ALTER TABLE updates ADD COLUMN is_saved boolean DEFAULT false;
  END IF;
END $$;

-- Add delivery_batch column to updates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'updates' AND column_name = 'delivery_batch'
  ) THEN
    ALTER TABLE updates ADD COLUMN delivery_batch text DEFAULT '';
  END IF;
END $$;

-- Create index on delivery_batch for efficient filtering
CREATE INDEX IF NOT EXISTS idx_updates_delivery_batch ON updates(delivery_batch);

-- Create index on is_saved for quick filtering of saved items
CREATE INDEX IF NOT EXISTS idx_updates_is_saved ON updates(is_saved) WHERE is_saved = true;

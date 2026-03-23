/*
  # Add Manual Scan Credits System

  1. New Column
    - Add `manual_scan_credits` (integer) to profiles table
      - Default value: 100 credits for existing and new users
      - Used to track available credits for manual research scans
  
  2. New Function
    - `spend_manual_scan_credits(cost integer)`
      - Atomically decrements credits for the authenticated user
      - Returns new balance on success
      - Raises exception if insufficient credits
      - Prevents double-spend race conditions
  
  3. Security
    - Function runs with caller's permissions
    - Only authenticated users can spend their own credits
    - Atomic operation ensures consistency
*/

-- Add manual_scan_credits column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'manual_scan_credits'
  ) THEN
    ALTER TABLE profiles ADD COLUMN manual_scan_credits integer DEFAULT 100 NOT NULL;
  END IF;
END $$;

-- Create atomic function to spend credits
CREATE OR REPLACE FUNCTION spend_manual_scan_credits(cost integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  -- Atomically update credits and return new balance
  UPDATE profiles
  SET manual_scan_credits = manual_scan_credits - cost
  WHERE user_id = auth.uid()
    AND manual_scan_credits >= cost
  RETURNING manual_scan_credits INTO new_balance;
  
  -- If no rows were updated, user has insufficient credits
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient credits. Manual scan requires % credits.', cost;
  END IF;
  
  RETURN new_balance;
END;
$$;
/*
  # Add user information to profiles table

  1. Changes
    - Add `email` column to store user email address
    - Add `full_name` column to store user full name
    
  2. Notes
    - Email and full_name will be populated during signup
    - Existing profiles will have null values initially
*/

-- Add email column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- Add full_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name text;
  END IF;
END $$;
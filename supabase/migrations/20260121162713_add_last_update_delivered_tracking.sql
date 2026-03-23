/*
  # Add Last Update Delivered Tracking

  ## Overview
  Adds field to track when the last batch of updates was delivered to the user.
  This ensures that subsequent update batches only contain articles published
  after the last delivery date.

  ## Changes

  1. **Subscriptions Table** - Add last_update_delivered_at field
     - `last_update_delivered_at` (timestamptz) - Timestamp of last update delivery
     - Optional field, defaults to NULL for new subscriptions
     - Updated each time a new batch of updates is delivered

  2. **Updates Table** - Add UPDATE policy for users
     - Allow users to update their own updates (for marking as read/saved)

  ## Notes
  - For new users without a last delivery, use first_update_date or account creation date
  - Date range calculation:
    - Monthly: Last update date to current date (or month interval)
    - Weekly: Last update date to current date (or week interval)
    - Daily: Last update date to current date (or day interval)
*/

-- Add last_update_delivered_at to subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'last_update_delivered_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN last_update_delivered_at timestamptz;
  END IF;
END $$;

-- Add UPDATE policy for updates table so users can mark articles as read/saved
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'updates' AND policyname = 'Users can update own updates'
  ) THEN
    CREATE POLICY "Users can update own updates"
      ON updates FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = updates.profile_id
          AND profiles.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = updates.profile_id
          AND profiles.user_id = auth.uid()
        )
      );
  END IF;
END $$;
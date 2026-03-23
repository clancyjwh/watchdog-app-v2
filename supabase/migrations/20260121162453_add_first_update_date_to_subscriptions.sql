/*
  # Add first_update_date to subscriptions table

  ## Overview
  Adds a field to track when the user wants to receive their first update.
  This allows users to choose their update schedule:
  - Daily: Start date for daily updates
  - Weekly: Which day of the week (e.g., every Saturday)
  - Monthly: Which day of the month (e.g., 15th of each month)

  ## Changes

  1. **Subscriptions Table** - Add first_update_date field
     - `first_update_date` (date) - Date when first update should be delivered
     - Optional field, can be NULL
     - Used to calculate subsequent update delivery dates

  ## Notes
  - Field is optional to support existing subscriptions
  - Frontend will calculate recurring dates based on this initial date
  - For weekly: updates recur on the same day of week
  - For monthly: updates recur on the same day of month
*/

-- Add first_update_date to subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'first_update_date'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN first_update_date date;
  END IF;
END $$;
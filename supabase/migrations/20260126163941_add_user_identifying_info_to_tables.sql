/*
  # Add User Identifying Information to Key Tables
  
  1. Changes
    - Add `user_email` and `user_name` columns to tables that have user/customer identifiers
    - Tables updated:
      - `stripe_subscriptions` - adds user_email, user_name for easy customer identification
      - `stripe_orders` - adds user_email, user_name for order tracking
      - `stripe_customers` - adds user_email, user_name for customer records
      - `payment_history` - adds user_email, user_name for payment records
      - `companies` - adds user_email, user_name for company ownership
      - `source_feedback` - adds user_email, user_name for feedback tracking
      - `user_blocked_sources` - adds user_email, user_name for blocked source tracking
  
  2. Purpose
    - Makes it easy to identify customers in admin queries without joining multiple tables
    - Provides human-readable information alongside IDs
    - Improves troubleshooting and customer support
  
  3. Notes
    - These fields should be kept in sync when user information changes
    - Consider adding triggers or updating these fields in application code
*/

-- Add user identifying columns to stripe_subscriptions
ALTER TABLE stripe_subscriptions 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_name text;

-- Add user identifying columns to stripe_orders
ALTER TABLE stripe_orders 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_name text;

-- Add user identifying columns to stripe_customers
ALTER TABLE stripe_customers 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_name text;

-- Add user identifying columns to payment_history
ALTER TABLE payment_history 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_name text;

-- Add user identifying columns to companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_name text;

-- Add user identifying columns to source_feedback
ALTER TABLE source_feedback 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_name text;

-- Add user identifying columns to user_blocked_sources
ALTER TABLE user_blocked_sources 
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_name text;

-- Create a function to sync user info across tables
CREATE OR REPLACE FUNCTION sync_user_info_to_companies()
RETURNS TRIGGER AS $$
BEGIN
  -- Update companies table when profiles are updated
  UPDATE companies
  SET 
    user_email = NEW.email,
    user_name = NEW.full_name
  WHERE user_id IN (
    SELECT user_id FROM profiles WHERE id = NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically sync user info from profiles to companies
DROP TRIGGER IF EXISTS sync_user_info_on_profile_update ON profiles;
CREATE TRIGGER sync_user_info_on_profile_update
  AFTER UPDATE OF email, full_name ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_info_to_companies();

-- Backfill existing data for companies
UPDATE companies c
SET 
  user_email = p.email,
  user_name = p.full_name
FROM profiles p
WHERE c.user_id = p.user_id;

-- Backfill existing data for stripe_customers
UPDATE stripe_customers sc
SET 
  user_email = p.email,
  user_name = p.full_name
FROM profiles p
WHERE sc.user_id = p.user_id;

-- Backfill existing data for payment_history
UPDATE payment_history ph
SET 
  user_email = p.email,
  user_name = p.full_name
FROM profiles p
WHERE ph.profile_id = p.id;

-- Backfill existing data for source_feedback
UPDATE source_feedback sf
SET 
  user_email = p.email,
  user_name = p.full_name
FROM profiles p
WHERE sf.user_id = p.user_id;

-- Backfill existing data for user_blocked_sources
UPDATE user_blocked_sources ubs
SET 
  user_email = p.email,
  user_name = p.full_name
FROM profiles p
WHERE ubs.user_id = p.user_id;
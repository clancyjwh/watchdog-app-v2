/*
  # Add Delivery Preferences for Enterprise Customers

  1. New Columns
    - Add `delivery_preferences` to profiles table
      - JSON column storing delivery method preferences
      - Options: email, slack, teams, webhook
      - Only accessible to Enterprise tier customers

  2. Delivery Method Rules
    - Basic tier: Dashboard only
    - Premium tier: Dashboard only
    - Enterprise tier: Dashboard + Custom delivery (email, Slack, Teams, etc.)

  3. Notes
    - Features marked as "Coming Soon" in UI
    - Default to dashboard delivery for all users
    - Custom delivery requires Enterprise subscription
*/

-- Add delivery_preferences column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'delivery_preferences'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN delivery_preferences jsonb DEFAULT '{"methods": ["dashboard"], "email_address": null, "slack_webhook": null, "teams_webhook": null, "custom_webhook": null}'::jsonb;
  END IF;
END $$;

-- Create a function to check if user has access to custom delivery
CREATE OR REPLACE FUNCTION has_custom_delivery_access(user_profile_id uuid)
RETURNS boolean AS $$
DECLARE
  user_tier text;
BEGIN
  -- Get the user's subscription tier
  SELECT s.tier INTO user_tier
  FROM subscriptions s
  WHERE s.profile_id = user_profile_id
  LIMIT 1;

  -- Only enterprise tier has access to custom delivery
  RETURN user_tier = 'enterprise';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the delivery preferences structure
COMMENT ON COLUMN profiles.delivery_preferences IS 'JSON structure: {"methods": ["dashboard", "email", "slack", "teams", "webhook"], "email_address": "user@example.com", "slack_webhook": "https://...", "teams_webhook": "https://...", "custom_webhook": "https://..."}';

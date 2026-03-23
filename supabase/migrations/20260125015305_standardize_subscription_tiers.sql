/*
  # Standardize Subscription Tiers to New Pricing Model

  1. Updates
    - Update tier limits to match new standardized pricing:
      * Basic: $59/month, 3 sources, 100 credits/month
      * Premium: $99/month, 5 sources, 300 credits/month
      * Enterprise: $149/month, 10 sources, 600 credits/month
    - Update get_tier_limits function to reflect new limits
    - Add monthly_credits column

  2. Pricing Rules
    - Subscription tier determines max sources and monthly credits
    - Update frequency NEVER changes price (user can select monthly, bi-weekly, or weekly)
    - Manual scans cost 25 credits each
    - NO per-source pricing

  3. Notes
    - Existing subscriptions will be updated to new limits
    - Credits are used only for manual scans
    - Frequency selection is cosmetic and doesn't affect billing
*/

-- Add monthly_credits column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'monthly_credits'
  ) THEN
    ALTER TABLE subscriptions
    ADD COLUMN monthly_credits integer DEFAULT 100;
  END IF;
END $$;

-- Drop and recreate the get_tier_limits function with new pricing
DROP FUNCTION IF EXISTS get_tier_limits(text);

CREATE OR REPLACE FUNCTION get_tier_limits(tier_name text)
RETURNS TABLE (
  max_companies integer,
  max_tracked_sources integer,
  monthly_manual_scans integer,
  monthly_credits integer,
  has_priority_support boolean,
  has_ai_insights boolean,
  has_custom_integrations boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- max_companies: not tier-limited anymore, kept for backward compatibility
    999999,
    -- max_tracked_sources: tier-specific
    CASE tier_name
      WHEN 'basic' THEN 3
      WHEN 'premium' THEN 5
      WHEN 'enterprise' THEN 10
      ELSE 3
    END,
    -- monthly_manual_scans: calculated from credits (kept for backward compatibility)
    CASE tier_name
      WHEN 'basic' THEN 4  -- 100 credits / 25 per scan
      WHEN 'premium' THEN 12  -- 300 credits / 25 per scan
      WHEN 'enterprise' THEN 24  -- 600 credits / 25 per scan
      ELSE 4
    END,
    -- monthly_credits: tier-specific
    CASE tier_name
      WHEN 'basic' THEN 100
      WHEN 'premium' THEN 300
      WHEN 'enterprise' THEN 600
      ELSE 100
    END,
    -- Features: all tiers have core features enabled
    true as has_priority_support,
    true as has_ai_insights,
    true as has_custom_integrations;
END;
$$ LANGUAGE plpgsql;

-- Update existing subscriptions to have new tier limits
UPDATE subscriptions
SET
  max_tracked_sources = 3,
  monthly_manual_scans = 4,
  monthly_credits = 100,
  has_priority_support = true,
  has_ai_insights = true,
  has_custom_integrations = true
WHERE tier = 'basic';

UPDATE subscriptions
SET
  max_tracked_sources = 5,
  monthly_manual_scans = 12,
  monthly_credits = 300,
  has_priority_support = true,
  has_ai_insights = true,
  has_custom_integrations = true
WHERE tier = 'premium';

UPDATE subscriptions
SET
  max_tracked_sources = 10,
  monthly_manual_scans = 24,
  monthly_credits = 600,
  has_priority_support = true,
  has_ai_insights = true,
  has_custom_integrations = true
WHERE tier = 'enterprise';

-- Update the subscription_tier_info view to include monthly_credits
DROP VIEW IF EXISTS subscription_tier_info;

CREATE OR REPLACE VIEW subscription_tier_info AS
SELECT
  s.id,
  s.profile_id,
  s.company_id,
  s.tier,
  s.subscription_status,
  s.max_companies,
  s.max_tracked_sources,
  s.monthly_manual_scans,
  s.monthly_credits,
  s.has_priority_support,
  s.has_ai_insights,
  s.has_custom_integrations,
  s.frequency,
  s.monthly_price,
  s.annual_price,
  -- Calculate usage
  (SELECT COUNT(*) FROM companies WHERE companies.user_id = (SELECT user_id FROM profiles WHERE id = s.profile_id)) as current_companies,
  (SELECT COUNT(*) FROM sources WHERE sources.profile_id = s.profile_id) as current_tracked_sources
FROM subscriptions s;

-- Grant access to the view
GRANT SELECT ON subscription_tier_info TO authenticated;
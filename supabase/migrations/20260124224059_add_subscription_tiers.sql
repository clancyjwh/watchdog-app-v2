/*
  # Add Subscription Tiers System

  1. Changes to subscriptions table
    - Add `tier` column (basic, premium, enterprise)
    - Add tier-specific limits and features
    
  2. New Features by Tier
    
    **Basic Tier:**
    - 1 company
    - 5 tracked sources
    - 10 manual scans per month
    - Weekly updates
    - Standard analysis depth
    
    **Premium Tier:**
    - 3 companies
    - 25 tracked sources
    - 50 manual scans per month
    - Daily updates
    - Deep analysis depth
    - Priority support
    
    **Enterprise Tier:**
    - Unlimited companies
    - Unlimited tracked sources
    - 200 manual scans per month
    - Real-time updates
    - AI-powered insights
    - Dedicated support
    - Custom integrations
    
  3. Security
    - Maintains existing RLS policies
*/

-- Add tier column to subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'tier'
  ) THEN
    ALTER TABLE subscriptions 
    ADD COLUMN tier text DEFAULT 'basic' CHECK (tier IN ('basic', 'premium', 'enterprise'));
  END IF;
END $$;

-- Add tier limits and features
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'max_companies'
  ) THEN
    ALTER TABLE subscriptions 
    ADD COLUMN max_companies integer DEFAULT 1,
    ADD COLUMN max_tracked_sources integer DEFAULT 5,
    ADD COLUMN monthly_manual_scans integer DEFAULT 10,
    ADD COLUMN has_priority_support boolean DEFAULT false,
    ADD COLUMN has_ai_insights boolean DEFAULT false,
    ADD COLUMN has_custom_integrations boolean DEFAULT false;
  END IF;
END $$;

-- Create a function to get tier limits
CREATE OR REPLACE FUNCTION get_tier_limits(tier_name text)
RETURNS TABLE (
  max_companies integer,
  max_tracked_sources integer,
  monthly_manual_scans integer,
  has_priority_support boolean,
  has_ai_insights boolean,
  has_custom_integrations boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE tier_name
      WHEN 'basic' THEN 1
      WHEN 'premium' THEN 3
      WHEN 'enterprise' THEN 999999
    END,
    CASE tier_name
      WHEN 'basic' THEN 5
      WHEN 'premium' THEN 25
      WHEN 'enterprise' THEN 999999
    END,
    CASE tier_name
      WHEN 'basic' THEN 10
      WHEN 'premium' THEN 50
      WHEN 'enterprise' THEN 200
    END,
    CASE tier_name
      WHEN 'basic' THEN false
      WHEN 'premium' THEN true
      WHEN 'enterprise' THEN true
    END,
    CASE tier_name
      WHEN 'basic' THEN false
      WHEN 'premium' THEN true
      WHEN 'enterprise' THEN true
    END,
    CASE tier_name
      WHEN 'basic' THEN false
      WHEN 'premium' THEN false
      WHEN 'enterprise' THEN true
    END;
END;
$$ LANGUAGE plpgsql;

-- Update existing subscriptions to have tier limits
UPDATE subscriptions
SET 
  max_companies = 1,
  max_tracked_sources = 5,
  monthly_manual_scans = 10,
  has_priority_support = false,
  has_ai_insights = false,
  has_custom_integrations = false
WHERE tier = 'basic' OR tier IS NULL;

-- Set tier to basic for any null values
UPDATE subscriptions
SET tier = 'basic'
WHERE tier IS NULL;

-- Create a view for easy tier information access
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
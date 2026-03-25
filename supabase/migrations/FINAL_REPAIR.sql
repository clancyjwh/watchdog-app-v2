-- WATCHDOG MASTER SYSTEM REPAIR (v2)
-- Run this in your Supabase SQL Editor.

-- 1. FIX COMPANIES TABLE (Missing columns that broke onboarding)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS analysis_depth TEXT DEFAULT 'standard';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS content_types TEXT[] DEFAULT '{}';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS results_per_scan INTEGER DEFAULT 5;

-- 2. FIX PROFILES TABLE
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS manual_scan_credits INTEGER DEFAULT 0;

-- 3. INTELLIGENT CREDIT RESTORATION
-- This looks at what the user paid for and fixes their balance immediately.
UPDATE profiles 
SET manual_scan_credits = 
  CASE 
    WHEN EXISTS (SELECT 1 FROM watchdog_subscribers s WHERE s.profile_id = profiles.id AND s.tier = 'enterprise') THEN 600
    WHEN EXISTS (SELECT 1 FROM watchdog_subscribers s WHERE s.profile_id = profiles.id AND s.tier = 'premium') THEN 300
    ELSE 100 -- Default to 100 for Basic/Trial users
  END
WHERE manual_scan_credits = 0;

-- 4. SYNC WATCHDOG_SUBSCRIBERS (Stripe Webhook Compatibility)
ALTER TABLE watchdog_subscribers ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE watchdog_subscribers ADD COLUMN IF NOT EXISTS monthly_price INTEGER DEFAULT 0;
ALTER TABLE watchdog_subscribers ADD COLUMN IF NOT EXISTS included_credits INTEGER DEFAULT 100;

-- 5. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

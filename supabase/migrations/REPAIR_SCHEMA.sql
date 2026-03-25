-- WATCHDOG MASTER SCHEMA REPAIR
-- Run this in your Supabase SQL Editor to ensure all tables match the application code exactly.

-- 1. FIX WATCHDOG_SUBSCRIBERS TABLE
DO $$
BEGIN
    -- Ensure table exists
    CREATE TABLE IF NOT EXISTS public.watchdog_subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID REFERENCES public.profiles(id) NOT NULL,
        company_id UUID REFERENCES public.companies(id),
        tier TEXT NOT NULL CHECK (tier IN ('basic', 'premium', 'enterprise')),
        status TEXT NOT NULL DEFAULT 'active',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        current_period_end TIMESTAMPTZ,
        cancel_at_period_end BOOLEAN DEFAULT false,
        monthly_price INTEGER NOT NULL DEFAULT 0,
        included_credits INTEGER NOT NULL DEFAULT 100,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(profile_id)
    );

    -- Add current_period_end if missing (Fixes your "Could not find column" error)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchdog_subscribers' AND column_name = 'current_period_end') THEN
        ALTER TABLE watchdog_subscribers ADD COLUMN current_period_end TIMESTAMPTZ;
    END IF;

    -- Ensure company_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchdog_subscribers' AND column_name = 'company_id') THEN
        ALTER TABLE watchdog_subscribers ADD COLUMN company_id UUID REFERENCES public.companies(id);
    END IF;

    -- Ensure monthly_price exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchdog_subscribers' AND column_name = 'monthly_price') THEN
        ALTER TABLE watchdog_subscribers ADD COLUMN monthly_price INTEGER NOT NULL DEFAULT 0;
    END IF;

    -- Ensure included_credits exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchdog_subscribers' AND column_name = 'included_credits') THEN
        ALTER TABLE watchdog_subscribers ADD COLUMN included_credits INTEGER NOT NULL DEFAULT 100;
    END IF;
END $$;

-- 2. FIX PROFILES TABLE
DO $$
BEGIN
    -- Ensure manual_scan_credits exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'manual_scan_credits') THEN
        ALTER TABLE profiles ADD COLUMN manual_scan_credits INTEGER DEFAULT 100;
    END IF;

    -- Ensure subscription_tier exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_tier') THEN
        ALTER TABLE profiles ADD COLUMN subscription_tier TEXT;
    END IF;

    -- Ensure subscription_status exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
        ALTER TABLE profiles ADD COLUMN subscription_status TEXT;
    END IF;
END $$;

-- 3. REFRESH SCHEMA CACHE
-- This tells Supabase to notice the new columns immediately
NOTIFY pgrst, 'reload schema';

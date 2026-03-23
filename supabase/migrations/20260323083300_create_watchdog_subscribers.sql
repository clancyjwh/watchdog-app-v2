-- Create the new watchdog_subscribers table
CREATE TABLE IF NOT EXISTS public.watchdog_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('basic', 'premium', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'trialing')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    monthly_price INTEGER NOT NULL,
    included_credits INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.watchdog_subscribers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own watchdog subscription"
    ON public.watchdog_subscribers FOR SELECT
    USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = profile_id));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_watchdog_subscribers_profile_id ON public.watchdog_subscribers(profile_id);
CREATE INDEX IF NOT EXISTS idx_watchdog_subscribers_stripe_customer_id ON public.watchdog_subscribers(stripe_customer_id);

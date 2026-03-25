-- Add company_id column to watchdog_subscribers
ALTER TABLE public.watchdog_subscribers 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Update RLS policy to include company check if desired
-- (The existing policy already checks profile_id which is linked to company)

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_watchdog_subscribers_company_id ON public.watchdog_subscribers(company_id);

-- Harden watchdog_subscribers with Unique Constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'watchdog_subscribers_profile_id_key'
    ) THEN
        ALTER TABLE public.watchdog_subscribers ADD CONSTRAINT watchdog_subscribers_profile_id_key UNIQUE (profile_id);
    END IF;
END $$;

-- Add is_scanning to companies to track background research state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'is_scanning'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN is_scanning BOOLEAN DEFAULT false;
  END IF;
END $$;

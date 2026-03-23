-- Add company_id and unique constraint to watchdog_subscribers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'watchdog_subscribers' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE watchdog_subscribers ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraint on profile_id to allow upsert
-- Note: If there are duplicates, this might fail, but in a clean environment it's needed.
ALTER TABLE public.watchdog_subscribers ADD CONSTRAINT watchdog_subscribers_profile_id_key UNIQUE (profile_id);

-- Add INSERT and UPDATE policies for authenticated users
CREATE POLICY "Users can insert their own watchdog subscription"
    ON public.watchdog_subscribers FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = profile_id));

CREATE POLICY "Users can update their own watchdog subscription"
    ON public.watchdog_subscribers FOR UPDATE
    TO authenticated
    USING (auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = profile_id))
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.profiles WHERE id = profile_id));

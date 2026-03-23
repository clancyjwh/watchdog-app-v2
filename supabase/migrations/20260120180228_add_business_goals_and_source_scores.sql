/*
  # Add Business Goals and AI-Scored Source Recommendations

  ## Overview
  Extends the database schema to support:
  - Detailed business information and monitoring goals
  - AI-powered source recommendations with relevance scores
  - Enhanced update tracking with content types and read status

  ## Changes

  1. **Profiles Table** - Add Detailed Business Fields
     - `monitoring_goals` (text) - User's specific goals for monitoring
     - `target_audience` (text) - Who the information is for
     - `key_challenges` (text) - Business challenges they're addressing
     - `content_types` (jsonb) - Array of selected content types
     
  2. **Source Recommendations Table** (NEW)
     - Stores AI-generated source recommendations with relevance scores
     - Links to profiles
     - Fields: name, url, description, relevance_score (1-10), reasoning, is_selected
     - Used during onboarding and in settings to show AI-scored sources
  
  3. **Updates Table** - Add Missing Fields
     - `original_url` (text) - Link to the actual article (not homepage)
     - `is_read` (boolean) - Track if user has read the update
     - `content_type` (text) - Type of content (news, legislation, etc.)
  
  4. **Sources Table** - Add Score Field
     - `relevance_score` (integer) - AI-assigned relevance score (1-10)
     - `rss_feed_url` (text) - RSS feed URL if available

  ## Security
  - RLS enabled on source_recommendations table
  - Policies restrict access to authenticated users' own data
*/

-- Add new fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'monitoring_goals'
  ) THEN
    ALTER TABLE profiles ADD COLUMN monitoring_goals text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'target_audience'
  ) THEN
    ALTER TABLE profiles ADD COLUMN target_audience text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'key_challenges'
  ) THEN
    ALTER TABLE profiles ADD COLUMN key_challenges text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'content_types'
  ) THEN
    ALTER TABLE profiles ADD COLUMN content_types jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add new fields to updates table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'updates' AND column_name = 'original_url'
  ) THEN
    ALTER TABLE updates ADD COLUMN original_url text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'updates' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE updates ADD COLUMN is_read boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'updates' AND column_name = 'content_type'
  ) THEN
    ALTER TABLE updates ADD COLUMN content_type text DEFAULT 'news';
  END IF;
END $$;

-- Add new fields to sources table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'relevance_score'
  ) THEN
    ALTER TABLE sources ADD COLUMN relevance_score integer DEFAULT 5;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sources' AND column_name = 'rss_feed_url'
  ) THEN
    ALTER TABLE sources ADD COLUMN rss_feed_url text DEFAULT '';
  END IF;
END $$;

-- Create source_recommendations table
CREATE TABLE IF NOT EXISTS source_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  description text DEFAULT '',
  relevance_score integer NOT NULL DEFAULT 5,
  reasoning text DEFAULT '',
  is_selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on source_recommendations
ALTER TABLE source_recommendations ENABLE ROW LEVEL SECURITY;

-- Source recommendations policies
CREATE POLICY "Users Can View Own Source Recommendations"
  ON source_recommendations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = source_recommendations.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users Can Insert Own Source Recommendations"
  ON source_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = source_recommendations.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users Can Update Own Source Recommendations"
  ON source_recommendations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = source_recommendations.profile_id
      AND profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = source_recommendations.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users Can Delete Own Source Recommendations"
  ON source_recommendations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = source_recommendations.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Add policy for updates table to allow updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'updates' AND policyname = 'Users Can Update Own Updates'
  ) THEN
    CREATE POLICY "Users Can Update Own Updates"
      ON updates FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = updates.profile_id
          AND profiles.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = updates.profile_id
          AND profiles.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_source_recommendations_profile_id ON source_recommendations(profile_id);
CREATE INDEX IF NOT EXISTS idx_source_recommendations_relevance_score ON source_recommendations(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_updates_is_read ON updates(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_updates_content_type ON updates(content_type);

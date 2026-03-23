/*
  # Add Research History Table

  1. New Tables
    - `research_history`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles)
      - `topic` (text)
      - `research_data` (jsonb) - stores the complete research result
      - `sources` (jsonb) - stores array of source objects with title and url
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `research_history` table
    - Add policy for authenticated users to read their own research history
    - Add policy for service role to insert research history

  3. Indexes
    - Add index on profile_id and topic for efficient lookups
*/

CREATE TABLE IF NOT EXISTS research_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  topic text NOT NULL,
  research_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE research_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own research history"
  ON research_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = research_history.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert research history"
  ON research_history
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_research_history_profile_topic 
  ON research_history(profile_id, topic, created_at DESC);
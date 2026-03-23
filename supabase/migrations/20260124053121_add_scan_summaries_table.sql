/*
  # Create scan_summaries table for topic-based scan results

  1. New Tables
    - `scan_summaries`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles)
      - `content_type` (text) - e.g., 'news', 'grants', 'legislation'
      - `summary_text` (text) - the comprehensive summary
      - `key_insights` (jsonb) - array of key insight bullet points
      - `citations` (jsonb) - array of citation objects with title and URL
      - `article_count` (integer) - number of articles summarized
      - `scan_date` (timestamptz) - when this scan was performed
      - `is_read` (boolean) - whether user has viewed this summary
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `scan_summaries` table
    - Add policy for users to read their own summaries
    - Add policy for users to update their own summaries (mark as read)
    - Add policy for authenticated users to insert summaries
*/

CREATE TABLE IF NOT EXISTS scan_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id),
  content_type text NOT NULL,
  summary_text text NOT NULL DEFAULT '',
  key_insights jsonb DEFAULT '[]'::jsonb,
  citations jsonb DEFAULT '[]'::jsonb,
  article_count integer DEFAULT 0,
  scan_date timestamptz NOT NULL DEFAULT now(),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scan_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scan summaries"
  ON scan_summaries
  FOR SELECT
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own scan summaries"
  ON scan_summaries
  FOR UPDATE
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own scan summaries"
  ON scan_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_scan_summaries_profile_id ON scan_summaries(profile_id);
CREATE INDEX IF NOT EXISTS idx_scan_summaries_scan_date ON scan_summaries(scan_date DESC);
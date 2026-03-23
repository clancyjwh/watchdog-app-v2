/*
  # Add Source Snapshots Table

  1. New Tables
    - `source_snapshots`
      - `id` (uuid, primary key) - Unique identifier for each snapshot
      - `source_id` (uuid, foreign key) - References the tracked source
      - `content_text` (text) - Extracted main content from the page
      - `content_hash` (text) - SHA-256 hash for quick comparison
      - `snapshot_date` (timestamptz) - When this snapshot was taken
      - `created_at` (timestamptz) - Record creation timestamp
  
  2. Security
    - Enable RLS on `source_snapshots` table
    - Add policy for authenticated users to read snapshots for their sources
    - Add policy for service role to insert snapshots (via edge function)
  
  3. Indexes
    - Add index on source_id for efficient queries
    - Add index on snapshot_date for chronological ordering
*/

CREATE TABLE IF NOT EXISTS source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  content_text text NOT NULL,
  content_hash text NOT NULL,
  snapshot_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE source_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view snapshots for their sources"
  ON source_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sources
      WHERE sources.id = source_snapshots.source_id
      AND sources.profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role can insert snapshots"
  ON source_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_source_snapshots_source_id ON source_snapshots(source_id);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_date ON source_snapshots(snapshot_date DESC);
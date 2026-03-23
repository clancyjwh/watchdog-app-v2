/*
  # Add Source Rating and Blocking System

  1. New Tables
    - `source_feedback`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, required, indexed)
      - `source_id` (text, required, indexed) - canonicalized source identifier
      - `item_id` (text, nullable) - specific update/article identifier
      - `rating` (integer, required, 1-5 range)
      - `created_at` (timestamptz, default now)
    
    - `user_blocked_sources`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, required, indexed)
      - `source_id` (text, required, indexed)
      - `blocked_at` (timestamptz, default now)

  2. Security
    - Enable RLS on both tables
    - Users can only read/write their own feedback and blocked sources
*/

-- Create source_feedback table
CREATE TABLE IF NOT EXISTS source_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  item_id text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_source_feedback_user_id ON source_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_source_feedback_source_id ON source_feedback(source_id);
CREATE INDEX IF NOT EXISTS idx_source_feedback_user_source ON source_feedback(user_id, source_id);

-- Enable RLS
ALTER TABLE source_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for source_feedback
CREATE POLICY "Users can view own feedback"
  ON source_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
  ON source_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
  ON source_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
  ON source_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create user_blocked_sources table
CREATE TABLE IF NOT EXISTS user_blocked_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  blocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, source_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_blocked_sources_user_id ON user_blocked_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_sources_source_id ON user_blocked_sources(source_id);

-- Enable RLS
ALTER TABLE user_blocked_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_blocked_sources
CREATE POLICY "Users can view own blocked sources"
  ON user_blocked_sources FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blocked sources"
  ON user_blocked_sources FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own blocked sources"
  ON user_blocked_sources FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

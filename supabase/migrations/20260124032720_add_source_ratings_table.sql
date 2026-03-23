/*
  # Add Source Ratings and Performance Tracking

  1. New Tables
    - `source_ratings`
      - `id` (uuid, primary key) - Unique identifier for each rating
      - `profile_id` (uuid, foreign key) - References the user who made the rating
      - `source_url` (text) - The URL of the source being rated
      - `source_name` (text) - Name of the source for easy reference
      - `rating` (integer 0-5) - Star rating given by user
      - `update_id` (uuid, foreign key, nullable) - Links to the specific article that was rated
      - `created_at` (timestamptz) - When the rating was created
      - `updated_at` (timestamptz) - When the rating was last modified
    
    - `source_performance`
      - `id` (uuid, primary key) - Unique identifier
      - `profile_id` (uuid, foreign key) - User who owns this performance data
      - `source_url` (text) - The URL of the source
      - `source_name` (text) - Name of the source
      - `average_rating` (numeric) - Calculated average rating
      - `total_ratings` (integer) - Count of ratings
      - `last_rated_at` (timestamptz) - Timestamp of most recent rating
      - Unique constraint on (profile_id, source_url)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own ratings
    - Add policies for users to read and update their own performance data
    
  3. Indexes
    - Index on source_url for fast lookups
    - Index on profile_id for user-specific queries
    - Composite index on (profile_id, source_url) for performance queries

  4. Functions
    - Trigger function to automatically update source_performance when ratings change
*/

-- Create source_ratings table
CREATE TABLE IF NOT EXISTS source_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 0 AND rating <= 5),
  update_id uuid REFERENCES updates(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create source_performance table
CREATE TABLE IF NOT EXISTS source_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_name text NOT NULL,
  average_rating numeric DEFAULT 0,
  total_ratings integer DEFAULT 0,
  last_rated_at timestamptz,
  UNIQUE(profile_id, source_url)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_source_ratings_profile_id ON source_ratings(profile_id);
CREATE INDEX IF NOT EXISTS idx_source_ratings_source_url ON source_ratings(source_url);
CREATE INDEX IF NOT EXISTS idx_source_ratings_profile_source ON source_ratings(profile_id, source_url);
CREATE INDEX IF NOT EXISTS idx_source_performance_profile_id ON source_performance(profile_id);
CREATE INDEX IF NOT EXISTS idx_source_performance_profile_source ON source_performance(profile_id, source_url);

-- Enable RLS
ALTER TABLE source_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for source_ratings
CREATE POLICY "Users can view own ratings"
  ON source_ratings FOR SELECT
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own ratings"
  ON source_ratings FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own ratings"
  ON source_ratings FOR UPDATE
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own ratings"
  ON source_ratings FOR DELETE
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for source_performance
CREATE POLICY "Users can view own source performance"
  ON source_performance FOR SELECT
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own source performance"
  ON source_performance FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own source performance"
  ON source_performance FOR UPDATE
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own source performance"
  ON source_performance FOR DELETE
  TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Function to update source_performance when ratings change
CREATE OR REPLACE FUNCTION update_source_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT and UPDATE operations
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    INSERT INTO source_performance (profile_id, source_url, source_name, average_rating, total_ratings, last_rated_at)
    SELECT 
      NEW.profile_id,
      NEW.source_url,
      NEW.source_name,
      AVG(rating)::numeric,
      COUNT(*)::integer,
      MAX(updated_at)
    FROM source_ratings
    WHERE profile_id = NEW.profile_id AND source_url = NEW.source_url
    GROUP BY profile_id, source_url
    ON CONFLICT (profile_id, source_url)
    DO UPDATE SET
      source_name = EXCLUDED.source_name,
      average_rating = EXCLUDED.average_rating,
      total_ratings = EXCLUDED.total_ratings,
      last_rated_at = EXCLUDED.last_rated_at;
    
    RETURN NEW;
  END IF;

  -- For DELETE operations
  IF (TG_OP = 'DELETE') THEN
    -- Recalculate or delete the performance record
    IF EXISTS (SELECT 1 FROM source_ratings WHERE profile_id = OLD.profile_id AND source_url = OLD.source_url) THEN
      UPDATE source_performance
      SET 
        average_rating = (SELECT AVG(rating)::numeric FROM source_ratings WHERE profile_id = OLD.profile_id AND source_url = OLD.source_url),
        total_ratings = (SELECT COUNT(*)::integer FROM source_ratings WHERE profile_id = OLD.profile_id AND source_url = OLD.source_url),
        last_rated_at = (SELECT MAX(updated_at) FROM source_ratings WHERE profile_id = OLD.profile_id AND source_url = OLD.source_url)
      WHERE profile_id = OLD.profile_id AND source_url = OLD.source_url;
    ELSE
      DELETE FROM source_performance WHERE profile_id = OLD.profile_id AND source_url = OLD.source_url;
    END IF;
    
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update source_performance
DROP TRIGGER IF EXISTS trigger_update_source_performance ON source_ratings;
CREATE TRIGGER trigger_update_source_performance
  AFTER INSERT OR UPDATE OR DELETE ON source_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_source_performance();
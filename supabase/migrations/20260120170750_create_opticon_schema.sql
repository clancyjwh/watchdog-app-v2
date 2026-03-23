/*
  # Opticon SaaS Platform Schema

  ## Overview
  Complete database schema for Opticon - an automated events monitoring platform.

  ## Tables Created

  1. **profiles**
     - Stores user business information and onboarding data
     - Links to auth.users via user_id
     - Fields: company_name, business_description, industry, onboarding_completed

  2. **topics**
     - Monitoring topics selected by users
     - Links to profiles
     - Fields: topic_name, is_custom (user-added vs AI-suggested)

  3. **sources**
     - Monitoring sources (websites, feeds, etc.)
     - Links to profiles
     - Fields: name, url, description, is_approved

  4. **subscriptions**
     - User subscription and pricing configuration
     - Links to profiles
     - Fields: frequency, delivery_method, relevance_threshold, monthly_price, annual_price

  5. **competitors**
     - Competitor tracking for users
     - Links to profiles
     - Fields: name, url

  6. **keywords**
     - Alert keywords for users
     - Links to profiles
     - Fields: keyword

  7. **updates**
     - Mock event updates for the dashboard
     - Links to profiles and sources
     - Fields: title, summary, relevance_score, source_url, published_at

  ## Security
  - RLS enabled on all tables
  - Policies restrict access to authenticated users' own data
  - Admin access requires special app_metadata flag
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  business_description text DEFAULT '',
  industry text DEFAULT '',
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_name text NOT NULL,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  description text DEFAULT '',
  is_approved boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'monthly',
  delivery_method text NOT NULL DEFAULT 'email',
  relevance_threshold integer DEFAULT 5,
  monthly_price decimal(10,2) DEFAULT 0,
  annual_price decimal(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id)
);

-- Create competitors table
CREATE TABLE IF NOT EXISTS competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create keywords table
CREATE TABLE IF NOT EXISTS keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create updates table
CREATE TABLE IF NOT EXISTS updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text NOT NULL,
  relevance_score integer NOT NULL DEFAULT 5,
  source_name text NOT NULL,
  source_url text NOT NULL,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE updates ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Topics policies
CREATE POLICY "Users can view own topics"
  ON topics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = topics.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own topics"
  ON topics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = topics.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own topics"
  ON topics FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = topics.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Sources policies
CREATE POLICY "Users can view own sources"
  ON sources FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = sources.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own sources"
  ON sources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = sources.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own sources"
  ON sources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = sources.profile_id
      AND profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = sources.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own sources"
  ON sources FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = sources.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = subscriptions.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = subscriptions.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = subscriptions.profile_id
      AND profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = subscriptions.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Competitors policies
CREATE POLICY "Users can view own competitors"
  ON competitors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = competitors.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own competitors"
  ON competitors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = competitors.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own competitors"
  ON competitors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = competitors.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Keywords policies
CREATE POLICY "Users can view own keywords"
  ON keywords FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = keywords.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own keywords"
  ON keywords FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = keywords.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own keywords"
  ON keywords FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = keywords.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Updates policies
CREATE POLICY "Users can view own updates"
  ON updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = updates.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own updates"
  ON updates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = updates.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_profile_id ON topics(profile_id);
CREATE INDEX IF NOT EXISTS idx_sources_profile_id ON sources(profile_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile_id ON subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_competitors_profile_id ON competitors(profile_id);
CREATE INDEX IF NOT EXISTS idx_keywords_profile_id ON keywords(profile_id);
CREATE INDEX IF NOT EXISTS idx_updates_profile_id ON updates(profile_id);
CREATE INDEX IF NOT EXISTS idx_updates_published_at ON updates(published_at DESC);
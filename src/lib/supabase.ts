import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Get authentication headers for edge function calls
 * Returns user session token if authenticated, otherwise returns anon key
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();

  return {
    'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
}

export type Company = {
  id: string;
  user_id: string;
  name: string;
  industry: string;
  description: string;
  monitoring_goals: string;
  location_country: string;
  location_province: string;
  location_city: string;
  business_context: any;
  content_types?: string[];
  analysis_depth?: string;
  results_per_scan?: number;
  subscription_frequency?: string;
  created_at: string;
};

export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company_name: string;
  onboarding_completed: boolean;
  subscription_tier: string;
  subscription_status: string;
  manual_scan_credits: number;
  current_company_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Topic = {
  id: string;
  profile_id: string;
  topic_name: string;
  is_custom: boolean;
  created_at: string;
};

export type Source = {
  id: string;
  profile_id: string;
  name: string;
  url: string;
  description: string;
  rss_feed_url: string;
  is_approved: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  profile_id: string;
  frequency: 'monthly' | 'weekly' | 'daily';
  delivery_method: 'dashboard' | 'email' | 'slack';
  relevance_threshold: number;
  monthly_price: number;
  annual_price: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  credits_reset_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Competitor = {
  id: string;
  profile_id: string;
  name: string;
  url: string;
  created_at: string;
};

export type Keyword = {
  id: string;
  profile_id: string;
  keyword: string;
  created_at: string;
};

export type Update = {
  id: string;
  profile_id: string;
  source_id: string | null;
  title: string;
  summary: string;
  relevance_score: number;
  relevance_reasoning: string | null;
  source_name: string;
  source_url: string;
  original_url: string;
  content_type: string;
  is_read: boolean;
  is_saved: boolean;
  delivery_batch: string;
  published_at: string;
  created_at: string;
};

export type SourceRating = {
  id: string;
  profile_id: string;
  source_url: string;
  source_name: string;
  rating: number;
  update_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SourcePerformance = {
  id: string;
  profile_id: string;
  source_url: string;
  source_name: string;
  average_rating: number;
  total_ratings: number;
  last_rated_at: string | null;
};

export type ScanSummary = {
  id: string;
  profile_id: string;
  company_id?: string;
  content_type: string;
  overview: string | null;
  summary_text: string;
  key_insights: string[];
  relevance_score?: number;
  relevance_reasoning?: string;
  citations: Array<{
    number: number;
    title: string;
    url: string;
    source: string;
    relevance_score?: number;
    relevance_reasoning?: string;
    summary?: string;
  }>;
  article_count: number;
  social_sentiment: string | null;
  scan_date: string;
  is_read: boolean;
  created_at: string;
};

export type PaymentHistory = {
  id: string;
  profile_id: string;
  company_id: string | null;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  stripe_payment_intent_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  transaction_type: 'subscription' | 'credit_purchase' | 'refund';
  invoice_url: string | null;
  invoice_pdf_url: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SourceFeedback = {
  id: string;
  user_id: string;
  source_id: string;
  item_id: string | null;
  rating: number;
  created_at: string;
};

export type UserBlockedSource = {
  id: string;
  user_id: string;
  source_id: string;
  blocked_at: string;
};

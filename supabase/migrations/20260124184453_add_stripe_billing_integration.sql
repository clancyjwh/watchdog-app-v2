/*
  # Add Stripe Billing Integration

  ## Overview
  This migration adds comprehensive Stripe integration for subscription management and billing.

  ## Changes

  1. **Subscriptions Table Updates**
     - `stripe_customer_id` (text) - Stripe customer identifier for billing
     - `stripe_subscription_id` (text) - Stripe subscription identifier
     - `stripe_price_id` (text) - Stripe price/plan identifier
     - `subscription_status` (text) - Current status: trialing, active, past_due, canceled, unpaid, incomplete
     - `trial_end` (timestamptz) - When trial period ends (if applicable)
     - `current_period_start` (timestamptz) - Current billing period start date
     - `current_period_end` (timestamptz) - Current billing period end date
     - `cancel_at_period_end` (boolean) - Whether subscription cancels at period end
     - `canceled_at` (timestamptz) - When subscription was canceled
     - `credits_reset_date` (date) - When credits were last reset (for monthly rollover)

  2. **New Table: payment_history**
     - Tracks all payment transactions and invoices
     - Links to profiles for payment records
     - Stores Stripe invoice and charge details
     - Maintains audit trail of all billing events

  ## Security
  - RLS enabled on payment_history table
  - Users can only view their own payment records
  - Atomic operations for credit management
*/

-- Add Stripe-related columns to subscriptions table
DO $$
BEGIN
  -- stripe_customer_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_customer_id text;
  END IF;

  -- stripe_subscription_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_subscription_id text;
  END IF;

  -- stripe_price_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN stripe_price_id text;
  END IF;

  -- subscription_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN subscription_status text DEFAULT 'active';
  END IF;

  -- trial_end
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'trial_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN trial_end timestamptz;
  END IF;

  -- current_period_start
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'current_period_start'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN current_period_start timestamptz DEFAULT now();
  END IF;

  -- current_period_end
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'current_period_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN current_period_end timestamptz;
  END IF;

  -- cancel_at_period_end
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'cancel_at_period_end'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end boolean DEFAULT false;
  END IF;

  -- canceled_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'canceled_at'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN canceled_at timestamptz;
  END IF;

  -- credits_reset_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'credits_reset_date'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN credits_reset_date date DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Create payment_history table for tracking all transactions
CREATE TABLE IF NOT EXISTS payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  
  -- Stripe identifiers
  stripe_invoice_id text,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  
  -- Transaction details
  amount_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL,
  description text,
  
  -- Transaction type (subscription, credit_purchase, refund, etc.)
  transaction_type text NOT NULL DEFAULT 'subscription',
  
  -- Invoice details
  invoice_url text,
  invoice_pdf_url text,
  
  -- Timestamps
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Payment history policies
CREATE POLICY "Users can view own payment history"
  ON payment_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = payment_history.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert payment records"
  ON payment_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = payment_history.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id 
  ON subscriptions(stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id 
  ON subscriptions(stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status 
  ON subscriptions(subscription_status);

CREATE INDEX IF NOT EXISTS idx_payment_history_profile_id 
  ON payment_history(profile_id);

CREATE INDEX IF NOT EXISTS idx_payment_history_stripe_invoice_id 
  ON payment_history(stripe_invoice_id) 
  WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_history_created_at 
  ON payment_history(created_at DESC);

-- Function to reset monthly credits
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset credits for users whose reset date is in the past
  UPDATE profiles
  SET manual_scan_credits = (
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM subscriptions 
        WHERE subscriptions.profile_id = profiles.id
        AND subscriptions.frequency = 'monthly'
      ) THEN 100
      WHEN EXISTS (
        SELECT 1 FROM subscriptions 
        WHERE subscriptions.profile_id = profiles.id
        AND subscriptions.frequency = 'weekly'
      ) THEN 300
      WHEN EXISTS (
        SELECT 1 FROM subscriptions 
        WHERE subscriptions.profile_id = profiles.id
        AND subscriptions.frequency = 'daily'
      ) THEN 600
      ELSE 100
    END
  )
  WHERE EXISTS (
    SELECT 1 FROM subscriptions
    WHERE subscriptions.profile_id = profiles.id
    AND subscriptions.credits_reset_date < CURRENT_DATE
    AND subscriptions.subscription_status = 'active'
  );
  
  -- Update reset dates
  UPDATE subscriptions
  SET credits_reset_date = CURRENT_DATE
  WHERE credits_reset_date < CURRENT_DATE
  AND subscription_status = 'active';
END;
$$;

-- Comment on function
COMMENT ON FUNCTION reset_monthly_credits IS 
  'Resets monthly credits for all active subscriptions whose reset date has passed. Should be run daily via cron job.';

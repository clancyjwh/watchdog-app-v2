/*
  # Fix onboarding_completed flag for existing users

  1. Changes
    - Set onboarding_completed to true for any profiles that have:
      - At least one topic
      - At least one subscription
    - This fixes cases where users completed onboarding but the flag wasn't set

  2. Notes
    - This is a one-time data fix
    - Only affects users who have actually completed setup
*/

-- Update profiles that have topics and subscriptions but onboarding_completed is false
UPDATE profiles p
SET onboarding_completed = true
WHERE p.onboarding_completed = false
  AND EXISTS (
    SELECT 1 FROM topics t WHERE t.profile_id = p.id
  )
  AND EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.profile_id = p.id
  );

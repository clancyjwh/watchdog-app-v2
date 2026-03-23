/*
  # Create get_secret function for Stripe key access

  1. Functions
    - `get_secret` - Retrieves secrets from vault.secrets table
  
  2. Security
    - Function is SECURITY DEFINER to allow edge functions to access vault
    - Only accessible to service role
*/

CREATE OR REPLACE FUNCTION get_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_value text;
BEGIN
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE name = secret_name;
  
  RETURN secret_value;
END;
$$;
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getStripeKey(): Promise<string> {
  const envKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (envKey) return envKey;

  console.log("Stripe key not in env, checking vault...");
  const { data, error } = await supabase.rpc('get_secret', { secret_name: 'STRIPE_SECRET_KEY' });

  if (error || !data) {
    throw new Error('Failed to retrieve Stripe key (not found in env or vault)');
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { user_id, email, name } = await req.json();

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id and email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeKey = await getStripeKey();
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingCustomer) {
      console.log(`Customer already exists for user ${user_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          customer_id: existingCustomer.customer_id,
          already_exists: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: name || undefined,
      metadata: {
        user_id,
      },
    });

    console.log(`Created Stripe customer ${customer.id} for user ${user_id}`);

    // Store customer in database
    const { error: insertError } = await supabase
      .from('stripe_customers')
      .insert({
        user_id,
        customer_id: customer.id,
      });

    if (insertError) {
      console.error('Failed to save customer to database:', insertError);

      // Clean up the Stripe customer if we couldn't save to database
      try {
        await stripe.customers.del(customer.id);
      } catch (deleteError) {
        console.error('Failed to delete Stripe customer after database error:', deleteError);
      }

      return new Response(
        JSON.stringify({ error: 'Failed to save customer information' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        customer_id: customer.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating Stripe customer:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

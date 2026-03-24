import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getStripeKey(supabase: any): Promise<string> {
  const envKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (envKey) return envKey;

  console.log("Stripe key not in env, checking vault...");
  const { data, error } = await supabase.rpc('get_secret', { secret_name: 'STRIPE_SECRET_KEY' });

  if (error || !data) {
    throw new Error('Failed to retrieve Stripe key (not found in env or vault)');
  }
  return data;
}

interface PortalRequest {
  profile_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("--- Starting create-billing-portal Request ---");
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    const requestData: PortalRequest = await req.json();
    console.log(`User: ${user.email}, Profile ID: ${requestData.profile_id}`);

    const stripeKey = await getStripeKey(createClient(supabaseUrl, supabaseServiceKey));
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // Get customer ID from profiles
    const { data: profile, error: dbError } = await supabaseClient
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", requestData.profile_id)
      .maybeSingle();

    if (dbError) {
      console.error("Database error looking up profile:", dbError);
      throw dbError;
    }

    if (!profile?.stripe_customer_id) {
      console.warn("No Stripe customer ID found for profile:", requestData.profile_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No active subscription or customer record found. Please add a payment method first." 
        }),
        { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    console.log("Found customer ID:", profile.stripe_customer_id);

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const returnUrl = `${origin}/billing`;

    console.log("Creating Stripe billing portal session...");
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    console.log("--- Success: Portal Created ---", session.url);
    return new Response(
      JSON.stringify({ success: true, url: session.url }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } }
    );

  } catch (error: any) {
    console.error("CRITICAL ERROR in create-billing-portal function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString(),
      }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});

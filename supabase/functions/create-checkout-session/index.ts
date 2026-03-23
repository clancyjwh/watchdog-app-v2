import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getStripeKey(): Promise<string> {
  const { data, error } = await supabase
    .rpc('get_secret', { secret_name: 'STRIPE_SECRET_KEY' });

  if (error || !data) {
    throw new Error('Failed to retrieve Stripe key from vault');
  }

  return data;
}

interface CheckoutRequest {
  type: "subscription" | "credits";
  tier?: "basic" | "premium" | "enterprise";
  profile_id: string;
  user_email: string;
  company_id?: string;
  company_name?: string;
  industry?: string;
  description?: string;
  monitoring_goals?: string | string[];
  credit_package?: {
    credits: number;
    price: number;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeKey = await getStripeKey();
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const requestData: CheckoutRequest = await req.json();

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const successUrl = `${origin}/billing?success=true`;
    const cancelUrl = `${origin}/billing?canceled=true`;

    if (requestData.type === "subscription") {
      const TIER_PRICES = {
        basic: 59,
        premium: 99,
        enterprise: 199,
      };

      const TIER_PRODUCT_IDS = {
        basic: 'prod_TqxKX5neHjRYiu',
        premium: 'prod_TqxLzaw1hDuXLo',
        enterprise: 'prod_U7pGAo3uBjGCkb',
      };

      const tier = requestData.tier || "basic";
      const price = TIER_PRICES[tier];

      const TIER_FEATURES = {
        basic: "5 companies, 10 sources, 100 manual credits/month, weekly updates",
        premium: "25 companies, 50 sources, 300 manual credits/month, daily updates, AI insights",
        enterprise: "Unlimited companies, 200 sources, 600 manual credits/month, real-time updates",
      };

      const session = await stripe.checkout.sessions.create({
        customer_email: requestData.user_email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product: TIER_PRODUCT_IDS[tier],
              unit_amount: price * 100,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          profile_id: requestData.profile_id,
          company_id: requestData.company_id || "",
          type: "subscription",
          tier: tier,
          billing_period: "monthly",
          company_name: requestData.company_name || "",
          industry: requestData.industry || "",
          description: requestData.description || "",
          monitoring_goals: Array.isArray(requestData.monitoring_goals) 
            ? requestData.monitoring_goals.join(', ') 
            : requestData.monitoring_goals || ""
        },
      });

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (requestData.type === "credits") {
      const session = await stripe.checkout.sessions.create({
        customer_email: requestData.user_email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${requestData.credit_package?.credits} Manual Scan Credits`,
                description: `One-time credit purchase (${Math.floor((requestData.credit_package?.credits || 0) / 25)} manual scans)`,
              },
              unit_amount: (requestData.credit_package?.price || 0) * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          profile_id: requestData.profile_id,
          type: "credits",
          credits: String(requestData.credit_package?.credits || 0),
        },
      });

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid request type");
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
        stripe_key_present: !!Deno.env.get("STRIPE_SECRET_KEY"),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

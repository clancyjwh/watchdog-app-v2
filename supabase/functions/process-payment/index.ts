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

interface PaymentRequest {
  action: 'save_card' | 'subscribe' | 'purchase_credits';
  payment_method_id: string;
  profile_id: string;
  user_email: string;
  tier?: 'basic' | 'premium' | 'enterprise';
  billing_period?: 'monthly' | 'yearly';
  credit_package?: {
    credits: number;
    price: number;
  };
  company_id?: string;
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

    const requestData: PaymentRequest = await req.json();

    let customer: Stripe.Customer;

    const existingCustomers = await stripe.customers.list({
      email: requestData.user_email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: requestData.user_email,
        metadata: {
          profile_id: requestData.profile_id,
        },
      });
    }

    await stripe.paymentMethods.attach(requestData.payment_method_id, {
      customer: customer.id,
    });

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: requestData.payment_method_id,
      },
    });

    if (requestData.action === 'save_card') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customer.id,
        })
        .eq('id', requestData.profile_id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
      }

      return new Response(
        JSON.stringify({ success: true, customer_id: customer.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requestData.action === 'subscribe') {
      const TIER_PRICES = {
        basic: { monthly: 59, yearly: 600 },
        premium: { monthly: 99, yearly: 1000 },
        enterprise: { monthly: 199, yearly: 2000 },
      };

      const tier = requestData.tier || "basic";
      const tierConfig = TIER_PRICES[tier];
      const isYearly = requestData.billing_period === "yearly";
      const price = isYearly ? tierConfig.yearly : tierConfig.monthly;

      const TIER_FEATURES = {
        basic: "100 manual scan credits/month, weekly updates, priority support",
        premium: "300 manual scan credits/month, daily updates, AI insights",
        enterprise: "600 manual scan credits/month, real-time updates, API access",
      };

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Plan`,
                description: TIER_FEATURES[tier],
              },
              unit_amount: price * 100,
              recurring: { interval: isYearly ? "year" : "month" },
            },
          },
        ],
        metadata: {
          profile_id: requestData.profile_id,
          company_id: requestData.company_id || "",
          type: "subscription",
          tier: tier,
          billing_period: requestData.billing_period || "monthly",
        },
      });

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          subscription_tier: tier,
          subscription_status: 'active',
        })
        .eq('id', requestData.profile_id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
      }

      return new Response(
        JSON.stringify({ success: true, subscription_id: subscription.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (requestData.action === 'purchase_credits') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: (requestData.credit_package?.price || 0) * 100,
        currency: 'usd',
        customer: customer.id,
        payment_method: requestData.payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          profile_id: requestData.profile_id,
          type: 'credits',
          credits: String(requestData.credit_package?.credits || 0),
        },
        description: `${requestData.credit_package?.credits} Manual Scan Credits`,
      });

      if (paymentIntent.status === 'succeeded') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            manual_scan_credits: supabase.rpc('increment', {
              x: requestData.credit_package?.credits || 0,
            }),
          })
          .eq('id', requestData.profile_id);

        if (updateError) {
          console.error('Error updating credits:', updateError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, payment_intent_id: paymentIntent.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("Error processing payment:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

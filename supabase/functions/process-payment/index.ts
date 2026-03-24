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
        'basic': '3 sources, 100 manual scan credits/month, 3-day free trial',
        'premium': '5 sources, 300 manual scan credits/month, 3-day free trial, advanced analytics',
        'enterprise': '10 sources, 600 manual scan credits/month, 3-day free trial, email/slack integration',
      };

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        trial_period_days: 3,
        items: [
          {
            price_data: {
              currency: "cad",
              product: TIER_PRODUCT_IDS[tier],
              unit_amount: price * 100,
              recurring: { interval: "month" },
            },
          },
        ],
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

      // Update profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          subscription_tier: tier,
          subscription_status: 'active',
          manual_scan_credits: tier === 'basic' ? 100 : tier === 'premium' ? 300 : 600,
        })
        .eq('id', requestData.profile_id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }

      // Upsert into watchdog_subscribers
      const { error: subError } = await supabase
        .from('watchdog_subscribers')
        .upsert({
          profile_id: requestData.profile_id,
          tier: tier,
          status: 'active',
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          monthly_price: price,
          included_credits: tier === 'basic' ? 100 : tier === 'premium' ? 300 : 600,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }, { onConflict: 'profile_id' });

      if (subError) {
        console.error('Error updating watchdog_subscribers:', subError);
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

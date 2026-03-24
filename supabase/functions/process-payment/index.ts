import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.5.0";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
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
  action: 'subscribe' | 'save_card' | 'purchase_credits';
  payment_method_id: string;
  profile_id: string;
  user_email: string;
  tier?: string;
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
    console.log("--- Starting process-payment Request ---");
    const requestData: PaymentRequest = await req.json();
    console.log("Action:", requestData.action);
    console.log("User Email:", requestData.user_email);
    console.log("Profile ID:", requestData.profile_id);

    const stripeKey = await getStripeKey();
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // 1. Ensure customer exists
    console.log("Checking Stripe for customer...");
    const existingCustomers = await stripe.customers.list({
      email: requestData.user_email,
      limit: 1,
    });

    let customer: Stripe.Customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      console.log("Existing customer found:", customer.id);
    } else {
      console.log("Creating new Stripe customer...");
      customer = await stripe.customers.create({
        email: requestData.user_email,
        metadata: {
          profile_id: requestData.profile_id,
        },
      });
      console.log("New customer created:", customer.id);
    }

    // 2. Attach payment method
    console.log("Attaching payment method:", requestData.payment_method_id);
    await stripe.paymentMethods.attach(requestData.payment_method_id, {
      customer: customer.id,
    });

    console.log("Setting as default payment method...");
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: requestData.payment_method_id,
      },
    });

    // 3. Handle specific action
    if (requestData.action === 'save_card') {
      console.log("Handling save_card action");
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_customer_id: customer.id,
        })
        .eq('id', requestData.profile_id);

      if (updateError) {
        console.error('Error updating profile in DB:', updateError);
      }

      console.log("--- Success: Card Saved ---");
      return new Response(
        JSON.stringify({ success: true, customer_id: customer.id }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    if (requestData.action === 'subscribe') {
      console.log("Handling subscribe action for tier:", requestData.tier);
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
      const price = TIER_PRICES[tier as keyof typeof TIER_PRICES] || 59;
      const productId = TIER_PRODUCT_IDS[tier as keyof typeof TIER_PRODUCT_IDS];

      if (!productId) {
        throw new Error(`Product ID not found for tier: ${tier}`);
      }

      console.log("Creating subscription in Stripe...");
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        trial_period_days: 3,
        items: [
          {
            price_data: {
              currency: "cad",
              product: productId,
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
        },
      });

      console.log("Subscription created:", subscription.id);

      // Update profiles and watchdog_subscribers
      console.log("Syncing to internal database...");
      const results = await Promise.allSettled([
        supabase
          .from('profiles')
          .update({
            stripe_customer_id: customer.id,
            stripe_subscription_id: subscription.id,
            subscription_tier: tier,
            subscription_status: 'active',
            manual_scan_credits: tier === 'basic' ? 100 : tier === 'premium' ? 300 : 600,
          })
          .eq('id', requestData.profile_id),
        supabase
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
          }, { onConflict: 'profile_id' })
      ]);
      
      console.log("DB Sync results:", results.map(r => r.status));

      console.log("--- Success: Subscribed ---");
      return new Response(
        JSON.stringify({ success: true, subscription_id: subscription.id }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    if (requestData.action === 'purchase_credits') {
      console.log("Handling purchase_credits action:", requestData.credit_package?.credits);
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
        console.log("PaymentIntent succeeded, incrementing credits in DB");
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            manual_scan_credits: supabase.rpc('increment', {
              x: requestData.credit_package?.credits || 0,
            }),
          })
          .eq('id', requestData.profile_id);

        if (updateError) {
          console.error('Error updating credits in DB:', updateError);
        }
      }

      console.log("--- Success: Credits Purchased ---");
      return new Response(
        JSON.stringify({ success: true, payment_intent_id: paymentIntent.id }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    throw new Error(`Unsupported action: ${requestData.action}`);

  } catch (error: any) {
    console.error("CRITICAL ERROR in process-payment function:", error);
    // Even in error, we return CORS headers so the client can read the error message
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString(),
      }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});

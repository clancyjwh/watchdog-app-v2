import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Map Stripe price IDs to subscription tiers
const PRICE_TO_TIER: Record<string, string> = {
  'prod_TqxKX5neHjRYiu': 'basic',
  'prod_TqxLzaw1hDuXLo': 'premium',
  'prod_U7pGAo3uBjGCkb': 'enterprise',
};

function getTierFromPriceId(priceId: string): string {
  return PRICE_TO_TIER[priceId] || 'basic';
}

async function notifySignupWebhook(data: {
  full_name: string;
  email: string;
  plan: string;
  payment_status: string;
  subscription_status?: string;
  subscription_id?: string;
  amount_paid?: number;
  currency?: string;
  period_end?: number;
  company_name?: string;
  industry?: string;
  description?: string;
  monitoring_goals?: string;
}) {
  try {
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-signup-webhook`;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('Failed to notify webhook:', await response.text());
    } else {
      console.info('Successfully notified signup webhook');
    }
  } catch (error) {
    console.error('Error calling signup webhook:', error);
  }
}

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      const metadata = (stripeData as any).metadata || {};
      await syncCustomerFromStripe(customerId, metadata);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        // Get user info from stripe_customers table
        const { data: customerData } = await supabase
          .from('stripe_customers')
          .select('user_id')
          .eq('customer_id', customerId)
          .single();

        let userEmail = null;
        let userName = null;

        if (customerData?.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('user_id', customerData.user_id)
            .single();

          if (profileData) {
            userEmail = profileData.email;
            userName = profileData.full_name;
          }
        }

        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
        } = stripeData as Stripe.Checkout.Session;

        // Insert the order into the stripe_orders table
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed',
          user_email: userEmail,
          user_name: userName,
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string, metadata: any = {}) {
  try {
    // Get user info from stripe_customers table
    const { data: customerData } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .single();

    let userEmail = null;
    let userName = null;

    if (customerData?.user_id) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('user_id', customerData.user_id)
        .single();

      if (profileData) {
        userEmail = profileData.email;
        userName = profileData.full_name;
      }
    }

    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // TODO verify if needed
    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
          user_email: userEmail,
          user_name: userName,
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;
    const productId = subscription.items.data[0].price.product as string;

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: priceId,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
        user_email: userEmail,
        user_name: userName,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }

    // Update the profiles table and watchdog_subscribers table for consistent state
    if (customerData?.user_id) {
        const tier = getTierFromPriceId(productId) || getTierFromPriceId(priceId);
        
        await supabase.from('profiles').update({
            subscription_status: subscription.status,
            subscription_tier: tier,
            manual_scan_credits: tier === 'basic' ? 100 : tier === 'premium' ? 300 : 600,
        }).eq('user_id', customerData.user_id);

        await supabase.from('watchdog_subscribers').upsert({
            profile_id: metadata.profile_id || customerData.user_id, // fallback to user_id if metadata is missing
            tier: tier,
            status: subscription.status,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            monthly_price: subscription.items.data[0].price.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : 0,
            included_credits: tier === 'basic' ? 100 : tier === 'premium' ? 300 : 600,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }, { onConflict: 'profile_id' });
    }

    console.info(`Successfully synced subscription for customer: ${customerId}`);

    // Notify webhook about successful subscription with all details
    if (userName && userEmail && subscription) {
      const productId = subscription.items.data[0].price.product as string;
      const planTier = getTierFromPriceId(productId) || getTierFromPriceId(subscription.items.data[0].price.id);
      
      await notifySignupWebhook({
        full_name: userName,
        email: userEmail,
        plan: planTier,
        payment_status: 'paid',
        subscription_status: subscription.status,
        subscription_id: subscription.id,
        amount_paid: subscription.items.data[0].price.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : 0,
        currency: subscription.currency,
        period_end: subscription.current_period_end,
        company_name: metadata.company_name,
        industry: metadata.industry,
        description: metadata.description,
        monitoring_goals: metadata.monitoring_goals
      });
    }
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}
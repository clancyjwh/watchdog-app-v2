import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PRICE_TO_TIER: Record<string, string> = {
  'prod_TqxKX5neHjRYiu': 'basic',
  'prod_TqxLzaw1hDuXLo': 'premium',
  'prod_U7pGAo3uBjGCkb': 'enterprise',
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    const body = await req.text();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const data = event.data.object as any;

    if (event.type === 'checkout.session.completed') {
      const profileId = data.client_reference_id;
      const customerId = data.customer;
      const subscriptionId = data.subscription;
      
      // Get the subscription details
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const productId = subscription.items.data[0].price.product as string;
      const tier = PRICE_TO_TIER[productId] || 'basic';

      // Update the database
      const { error } = await supabase
        .from('watchdog_subscribers')
        .upsert({
          profile_id: profileId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: 'active',
          tier: tier,
          monthly_price: subscription.items.data[0].price.unit_amount! / 100,
          included_credits: tier === 'basic' ? 100 : tier === 'premium' ? 300 : 600,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }, { onConflict: 'profile_id' });

      if (error) {
        console.error('Error updating subscriber:', error);
        return new Response('Error updating database', { status: 500 });
      }

      // Update profile credits
      await supabase.from('profiles').update({
        manual_scan_credits: tier === 'basic' ? 100 : tier === 'premium' ? 300 : 600,
      }).eq('id', profileId);
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscriptionId = data.id;
      await supabase
        .from('watchdog_subscribers')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscriptionId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('Webhook Error:', err.message);
    return new Response(err.message, { status: 500 });
  }
});

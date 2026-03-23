import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WEBHOOK_URL = 'https://hook.us2.make.com/adu8oln2b5ghzhy2bmm76flmgh1neao2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SignupData {
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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: SignupData = await req.json();
    const {
      full_name,
      email,
      plan,
      payment_status,
      subscription_status,
      subscription_id,
      amount_paid,
      currency,
      period_end,
      company_name,
      industry,
      description,
      monitoring_goals
    } = body;

    if (!full_name || !email || !plan) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: full_name, email, plan' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        full_name,
        email,
        plan,
        payment_status,
        subscription_status,
        subscription_id,
        amount_paid,
        currency,
        period_end: period_end ? new Date(period_end * 1000).toISOString() : null,
        company_name,
        industry,
        description,
        monitoring_goals,
        timestamp: new Date().toISOString()
      }),
    });

    if (!webhookResponse.ok) {
      console.error('Webhook call failed:', await webhookResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to notify webhook' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in notify-signup-webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

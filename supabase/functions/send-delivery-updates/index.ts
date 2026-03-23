import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DELIVERY_WEBHOOK_URL = 'https://hook.us2.make.com/4v825xhd9uew9ffhkpefvivvs7kaq0ql';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Update {
  id: string;
  title: string;
  summary: string;
  relevance_reasoning: string;
  original_url: string;
  published_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { profile_id, updates, medium } = await req.json();

    if (!profile_id || !updates || !Array.isArray(updates) || !medium) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: profile_id, updates (array), medium' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabase
      .from('profiles')
      .select('delivery_preferences, email')
      .eq('id', profile_id)
      .maybeSingle();

    if (!profile || !profile.delivery_preferences) {
      return new Response(
        JSON.stringify({ error: 'Profile not found or no delivery preferences set' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const deliveryPrefs = profile.delivery_preferences as any;

    if (!deliveryPrefs.methods.includes(medium.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: `Delivery method ${medium} not enabled for this profile` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const userSignupEmail = profile.email;
    const deliveryEmail = deliveryPrefs.email_address || userSignupEmail;

    const formattedArticles = updates.map((update: Update) => {
      const date = update.published_at ? new Date(update.published_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 'Date not available';

      return `Headline: ${update.title}
Summary: ${update.summary}
Why it matters: ${update.relevance_reasoning || 'Relevant to your business interests'}
Source link: ${update.original_url}
Date: ${date}`;
    }).join('\n\n---\n\n');

    const webhookResponse = await fetch(DELIVERY_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Medium: medium,
        articles: formattedArticles,
        user_email: userSignupEmail,
        delivery_email: deliveryEmail,
      }),
    });

    if (!webhookResponse.ok) {
      console.error('Webhook call failed:', await webhookResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to send updates to delivery webhook' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, updates_sent: updates.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-delivery-updates:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

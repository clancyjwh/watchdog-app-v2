import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type UserProfile = {
  userId: string;
  profile: {
    businessDescription: string;
    topics: string[];
    sources: Array<{ name: string; url: string; description: string }>;
    frequency: string;
    contentTypes: string[];
    relevanceThreshold: number;
    competitors: Array<{ name: string; url: string }>;
    keywords: string[];
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: UserProfile = await req.json();

    console.log('Received profile update for user:', payload.userId);
    console.log('Profile data:', JSON.stringify(payload.profile, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Profile update received and logged. Make.com should process this webhook.',
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing profile update:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

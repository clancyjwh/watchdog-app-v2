import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PERPLEXITY_API_KEY = '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';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { businessDescription, industry } = await req.json();

    if (!businessDescription || !industry) {
      return new Response(
        JSON.stringify({ error: 'Business description and industry are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const prompt = `Based on this business: "${businessDescription}" in the ${industry} industry, suggest 8-10 simple monitoring topics. Keep them SHORT (2-4 words max) and easy to understand.

Good topics (SHORT and SIMPLE):
- "AI trends"
- "New regulations"
- "Grant programs"
- "Market news"

Bad topics (TOO WORDY):
- "Federal environmental compliance requirements"
- "Competitive intelligence and market analysis"
- "Emerging technology adoption patterns"

Return ONLY a JSON array of SHORT topic strings (2-4 words each), nothing else. Example:
["Topic 1", "Topic 2", "Topic 3"]`;

    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a business intelligence assistant. Return only valid JSON arrays with no additional text or formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const topics = JSON.parse(jsonMatch[0]);
      if (Array.isArray(topics)) {
        return new Response(
          JSON.stringify({ topics }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Unable to parse topics from AI response' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating topic suggestions:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate topic suggestions',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SourceRecommendation {
  name: string;
  url: string;
  description: string;
  relevance_score: number;
  reasoning: string;
}

interface RequestBody {
  businessDescription: string;
  industry: string;
  monitoringGoals?: string;
  topics?: string[];
  locationCountry?: string;
  locationProvince?: string;
  locationCity?: string;
  businessContext?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: RequestBody = await req.json();
    const {
      businessDescription,
      industry,
      monitoringGoals = '',
      topics = [],
      locationCountry = '',
      locationProvince = '',
      locationCity = '',
      businessContext = []
    } = body;

    if (!businessDescription || !industry) {
      return new Response(
        JSON.stringify({ error: 'Business Description And Industry Are Required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const locationStr = [locationCity, locationProvince, locationCountry].filter(Boolean).join(', ');

    const prompt = `CRITICAL: You are recommending SPECIFIC PAGES for a business to monitor for changes, NOT general websites or news sources.

Business Profile:
WHAT THIS BUSINESS DOES: ${businessDescription}
Industry: ${industry}
${locationStr ? `Location: ${locationStr}` : ''}
${businessContext.length > 0 ? `Business Context: ${businessContext.join(', ')}` : ''}
${monitoringGoals ? `Monitoring goals: ${monitoringGoals}` : ''}
${topics.length > 0 ? `Topics of interest: ${topics.join(', ')}` : ''}

Task: Find 8-10 SPECIFIC regulatory, permit, or requirement pages that this business should monitor for changes.

MANDATORY URL REQUIREMENTS - READ CAREFULLY:
❌ NEVER recommend:
- Homepages (e.g., "epa.gov", "ministry.gov.bc.ca")
- Landing pages or portals (e.g., "example.com/permits")
- News feeds or blog sections (e.g., "example.com/news")
- General category pages (e.g., "example.com/regulations")
- Search results pages or indexes

✅ ONLY recommend SPECIFIC pages that contain:
- Explicit regulatory requirements (e.g., "When a permit is required")
- Permit application requirements and procedures
- Compliance guidelines and exemptions
- Licensing requirements and conditions
- Specific rule or regulation pages
- Official guidance documents

Each URL MUST:
- Be a DIRECT link to a page where rules/requirements are STATED
- Contain text like "requirements", "when required", "exemptions", "must", "shall"
- Be something that could CHANGE and the business would need to know about it

EXAMPLES:

BAD (DO NOT RECOMMEND):
❌ "https://www.epa.gov" (homepage)
❌ "https://www2.gov.bc.ca/gov/content/environment" (category page)
❌ "https://example.com/news" (news feed)
❌ "https://dfo-mpo.gc.ca/index-eng.htm" (landing page)

GOOD (THESE ARE WHAT WE WANT):
✅ "https://www.pac.dfo-mpo.gc.ca/consultation/aquaculture-eng.html" (specific guidance)
✅ "https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/laws-policies-standards-guidance/best-management-practices/aquatic-ecosystems" (specific requirements)
✅ "https://www.epa.gov/npdes/stormwater-discharges-construction-activities" (specific permit requirements)

CRITICAL GEOGRAPHIC FILTERING:
${locationStr ? `- This business operates in ${locationStr}
- ONLY recommend pages from jurisdictions that apply to this location
- Focus on: ${locationCity ? `${locationCity} bylaws, ` : ''}${locationProvince ? `${locationProvince} provincial regulations, ` : ''}${locationCountry} federal regulations
- EXCLUDE regulations from other provinces/states/countries` : ''}

For each source, provide:
1. name: Short descriptive name of what this page covers
2. url: DIRECT URL to the specific page (NOT a homepage)
3. description: What specific requirements or rules this page contains (1-2 sentences)
4. relevance_score: Score from 1-10 based on how critical these requirements are to this business
5. reasoning: Why this SPECIFIC page is important to monitor

Return ONLY a valid JSON array of objects. No additional text or formatting.

Example format:
[
  {
    "name": "Aquatic Species Permit Requirements",
    "url": "https://www2.gov.bc.ca/gov/content/environment/plants-animals-ecosystems/fish/aquatic-species/permit-requirements",
    "description": "Details when permits are required for work affecting aquatic species and ecosystems in BC",
    "relevance_score": 9,
    "reasoning": "Critical page that defines permit triggers for this environmental consulting business"
  }
]`;

    const perplexityResponse = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a regulatory compliance specialist. Your job is to find SPECIFIC regulatory and requirement pages (NOT homepages or news feeds) that businesses need to monitor for changes. Each URL must be a direct link to a page containing explicit rules, requirements, or permit procedures. NEVER suggest homepages, landing pages, or news sections. Return only valid JSON arrays with no additional text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!perplexityResponse.ok) {
      throw new Error(`Perplexity API Error: ${perplexityResponse.status}`);
    }

    const perplexityData = await perplexityResponse.json();
    const content = perplexityData.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed To Parse Perplexity Response');
    }

    const sources: SourceRecommendation[] = JSON.parse(jsonMatch[0]);

    sources.sort((a, b) => b.relevance_score - a.relevance_score);

    return new Response(
      JSON.stringify({ sources }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed To Generate Source Recommendations',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

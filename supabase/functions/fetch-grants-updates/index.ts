import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRANTS_GOV_API_URL = 'https://api.grants.gov/v1/api/search2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GrantOpportunity {
  id: string;
  number: string;
  title: string;
  agencyCode: string;
  agencyName: string;
  openDate: string;
  closeDate: string;
  oppStatus: string;
  docType: string;
  alnList?: string[];
}

interface GrantsGovResponse {
  data: {
    oppHits: GrantOpportunity[];
    hitCount: number;
  };
}

interface RequestBody {
  topics: string[];
  industry: string;
  businessDescription?: string;
  location?: string;
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
    const { topics, industry, businessDescription = '', location = '' } = body;

    if (!topics || topics.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Topics are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('=== FETCHING GRANTS FROM GRANTS.GOV ===');
    console.log('Topics:', topics);
    console.log('Industry:', industry);
    console.log('Location:', location);

    // Build search query from topics and industry
    const searchTerms = [...topics, industry].filter(Boolean).join(' ');
    console.log('Search terms:', searchTerms);

    // Call Grants.gov API
    const grantsPayload = {
      rows: 20,
      keyword: searchTerms,
      oppStatuses: "forecasted|posted",
      agencies: "",
      fundingCategories: ""
    };

    console.log('Calling Grants.gov API...');
    const grantsResponse = await fetch(GRANTS_GOV_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(grantsPayload),
    });

    if (!grantsResponse.ok) {
      console.error(`Grants.gov API Error: ${grantsResponse.status}`);
      const errorText = await grantsResponse.text();
      console.error('Error response:', errorText);
      return new Response(
        JSON.stringify({ grants: [], error: 'Failed to fetch grants' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const grantsData: GrantsGovResponse = await grantsResponse.json();
    const grants = grantsData.data?.oppHits || [];

    console.log(`Grants.gov returned ${grants.length} opportunities`);

    // Filter grants from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentGrants = grants.filter(grant => {
      if (!grant.openDate) return false;

      try {
        // Parse date in MM/DD/YYYY format
        const [month, day, year] = grant.openDate.split('/').map(Number);
        const openDate = new Date(year, month - 1, day);
        return openDate >= thirtyDaysAgo;
      } catch (error) {
        console.error(`Error parsing date ${grant.openDate}:`, error);
        return false;
      }
    });

    console.log(`Filtered to ${recentGrants.length} grants from last 30 days`);

    // Normalize grants to standard update format
    const normalizedGrants = recentGrants.map(grant => {
      const grantUrl = `https://www.grants.gov/search-results-detail/${grant.number}`;

      // Parse dates
      let publishedDate = new Date().toISOString();
      if (grant.openDate) {
        try {
          const [month, day, year] = grant.openDate.split('/').map(Number);
          publishedDate = new Date(year, month - 1, day).toISOString();
        } catch (error) {
          console.error(`Error parsing date ${grant.openDate}:`, error);
        }
      }

      // Build description with agency and close date info
      let description = `${grant.agencyName} (${grant.agencyCode})`;
      if (grant.closeDate) {
        description += ` • Closes: ${grant.closeDate}`;
      }
      description += ` • Status: ${grant.oppStatus}`;

      return {
        title: grant.title,
        summary: description,
        source_name: "Grants.gov",
        source_url: "https://www.grants.gov",
        original_url: grantUrl,
        content_type: "grant",
        relevance_score: 8, // Will be re-scored by OpenAI in main flow
        published_at: publishedDate,
        api_source: 'grants_gov',
        metadata: {
          agency: grant.agencyName,
          agencyCode: grant.agencyCode,
          opportunityNumber: grant.number,
          openDate: grant.openDate,
          closeDate: grant.closeDate,
          status: grant.oppStatus,
        }
      };
    });

    console.log(`Normalized ${normalizedGrants.length} grants`);

    return new Response(
      JSON.stringify({
        grants: normalizedGrants,
        totalFound: grants.length,
        recentCount: recentGrants.length,
        returned: normalizedGrants.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch grants',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

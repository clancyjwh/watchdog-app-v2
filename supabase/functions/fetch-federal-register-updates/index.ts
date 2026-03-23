import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const FEDERAL_REGISTER_API_URL = 'https://www.federalregister.gov/api/v1/documents.json';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Agency {
  name: string;
}

interface FederalRegisterDocument {
  title: string;
  abstract: string;
  html_url: string;
  publication_date: string;
  agencies: Agency[];
  type: string;
}

interface FederalRegisterResponse {
  results: FederalRegisterDocument[];
  count: number;
  total_pages: number;
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

    console.log('=== FETCHING REGULATIONS FROM FEDERAL REGISTER ===');
    console.log('Topics:', topics);
    console.log('Industry:', industry);

    // Get documents from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];

    // Build API URL with query parameters
    const params = new URLSearchParams({
      'conditions[publication_date][gte]': dateFrom,
      'per_page': '50',
      'fields[]': ['title', 'abstract', 'html_url', 'publication_date', 'agencies', 'type']
    });

    // Add document types
    ['RULE', 'PRORULE', 'NOTICE'].forEach(type => {
      params.append('conditions[type][]', type);
    });

    const apiUrl = `${FEDERAL_REGISTER_API_URL}?${params.toString()}`;

    console.log('Calling Federal Register API...');
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(`Federal Register API Error: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return new Response(
        JSON.stringify({ regulations: [], error: 'Failed to fetch regulations' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data: FederalRegisterResponse = await response.json();
    const documents = data.results || [];

    console.log(`Federal Register returned ${documents.length} documents`);

    // Filter documents by relevance to topics/industry (basic keyword matching)
    const searchTerms = [...topics, industry].filter(Boolean).map(t => t.toLowerCase());

    const relevantDocuments = documents.filter(doc => {
      const searchText = `${doc.title} ${doc.abstract || ''}`.toLowerCase();
      return searchTerms.some(term => searchText.includes(term));
    });

    console.log(`Filtered to ${relevantDocuments.length} relevant regulations`);

    // Normalize to standard update format
    const normalizedRegulations = relevantDocuments.map(doc => {
      const agencyNames = doc.agencies?.map(a => a.name).join(', ') || 'Unknown Agency';

      let docTypeLabel = doc.type;
      if (doc.type === 'RULE') docTypeLabel = 'Final Rule';
      else if (doc.type === 'PRORULE') docTypeLabel = 'Proposed Rule';
      else if (doc.type === 'NOTICE') docTypeLabel = 'Notice';

      const description = doc.abstract || doc.title;

      // Parse publication date
      let publishedDate = new Date().toISOString();
      if (doc.publication_date) {
        try {
          publishedDate = new Date(doc.publication_date).toISOString();
        } catch (error) {
          console.error(`Error parsing date ${doc.publication_date}:`, error);
        }
      }

      return {
        title: doc.title,
        summary: `${agencyNames} • ${docTypeLabel} • ${description}`,
        source_name: "Federal Register",
        source_url: "https://www.federalregister.gov",
        original_url: doc.html_url,
        content_type: "regulation",
        relevance_score: 8, // Will be re-scored by OpenAI in main flow
        published_at: publishedDate,
        api_source: 'federal_register',
        metadata: {
          agencies: agencyNames,
          documentType: docTypeLabel,
          type: doc.type,
        }
      };
    });

    console.log(`Normalized ${normalizedRegulations.length} regulations`);

    return new Response(
      JSON.stringify({
        regulations: normalizedRegulations,
        totalFound: documents.length,
        relevantCount: relevantDocuments.length,
        returned: normalizedRegulations.length
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
        error: 'Failed to fetch regulations',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

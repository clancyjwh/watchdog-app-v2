import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PERPLEXITY_API_KEY = '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';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const knownRSSFeeds: Record<string, string> = {
  'Reuters': 'https://www.reutersagency.com/feed/',
  'AP News': 'https://rsshub.app/apnews/topics/business',
  'BBC News': 'https://feeds.bbci.co.uk/news/rss.xml',
  'The Guardian': 'https://www.theguardian.com/world/rss',
  'Federal Register': 'https://www.federalregister.gov/api/v1/documents.rss',
  'Grants.gov': 'https://www.grants.gov/rss/GG_NewOpp.xml',
  'TechCrunch': 'https://techcrunch.com/feed/',
  'VentureBeat': 'https://venturebeat.com/feed/',
  'The Verge': 'https://www.theverge.com/rss/index.xml',
  'Wired': 'https://www.wired.com/feed/rss',
  'Bloomberg': 'https://www.bloomberg.com/feed/podcast/etf-report.xml',
  'Forbes': 'https://www.forbes.com/real-time/feed2/',
  'WSJ': 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
};

function getRSSFeedForSource(sourceName: string, sourceUrl: string): string | null {
  if (knownRSSFeeds[sourceName]) {
    return knownRSSFeeds[sourceName];
  }

  const url = new URL(sourceUrl);
  const hostname = url.hostname.replace('www.', '');

  const commonPatterns = [
    `${sourceUrl}/feed`,
    `${sourceUrl}/rss`,
    `${sourceUrl}/feed.xml`,
    `${sourceUrl}/rss.xml`,
    `${url.protocol}//${hostname}/feed`,
    `${url.protocol}//${hostname}/rss`,
  ];

  return commonPatterns[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      topics,
      industry,
      businessDescription = '',
      location = '',
      category
    } = await req.json();

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Topics array is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!industry) {
      return new Response(
        JSON.stringify({ error: 'Industry is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const locationContext = location
      ? `\n\nIMPORTANT: Business is in ${location}. ONLY suggest sources that publish content relevant to this location. Do NOT suggest sources from other countries unless they cover international news.`
      : '';

    const businessContext = businessDescription
      ? `\n\nBusiness: ${businessDescription}`
      : '';

    const categoryContext = category
      ? `\n\nFOCUS: ONLY suggest sources in the "${category}" category. All sources must be specifically related to ${category}.`
      : '';

    const prompt = `Find 6-8 ACTIVE, CURRENT sources that regularly publish fresh content about: ${topics.join(', ')} for ${industry} industry.${businessContext}${locationContext}${categoryContext}

STRICT REQUIREMENTS:
- ONLY suggest sources that publish NEW content regularly (daily/weekly)
- ONLY suggest sources with ACTIVE RSS feeds or news sections
- NO static government pages, old PDFs, or archived content
- NO generic sites like regulations.gov or usa.gov homepage
- Focus on: active news outlets, industry blogs, government news feeds, trade publications

DO NOT include:
❌ Static PDF repositories
❌ Archive sites
❌ Generic government homepages without news feeds
❌ Sites that haven't published in months
❌ Academic papers or research from years ago

ONLY include:
✅ Active news sites with daily/weekly updates
✅ Government agencies with active press release feeds
✅ Industry publications with regular articles
✅ Trade associations with news sections

For each source return:
- name: Official source name
- url: Main website URL (to their news/updates section if possible)
- description: What they cover (max 15 words)
- category: Single word/short phrase describing the main content type (e.g., "Grants", "News", "Regulations", "Legislation", "Industry Reports", "Press Releases", "Market Data", "Research", "Trade Publications")
- rssFeedUrl: RSS feed URL if available
- relevanceScore: 7-10 ONLY (if it's not at least 7, don't include it)

Return ONLY a JSON array, no text before or after:
[{"name": "Source Name", "url": "https://example.com/news", "description": "Brief description", "category": "News", "rssFeedUrl": "https://example.com/feed", "relevanceScore": 9}]`;

    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant finding ACTIVE news sources. Only suggest sources that publish fresh content regularly. Return only valid JSON.',
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
      const sources = JSON.parse(jsonMatch[0]);
      if (Array.isArray(sources) && sources.length > 0) {
        const validSources = sources.filter(source => {
          const hasValidUrl = source.url && source.url.startsWith('http');
          const hasName = source.name && source.name.length > 0;
          const notPDF = !source.url.toLowerCase().endsWith('.pdf');
          const notGeneric = !source.url.includes('regulations.gov') &&
                           !source.url.includes('govinfo.gov') &&
                           !source.url.includes('usa.gov/laws');
          const highRelevance = (source.relevanceScore || 0) >= 7;

          return hasValidUrl && hasName && notPDF && notGeneric && highRelevance;
        });

        if (validSources.length < 3) {
          console.log('Not enough quality sources found');
          return new Response(
            JSON.stringify({ sources: null }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const sourcesWithRSS = validSources.map(source => {
          if (!source.rssFeedUrl) {
            const discoveredRSS = getRSSFeedForSource(source.name, source.url);
            if (discoveredRSS) {
              console.log(`Discovered RSS feed for ${source.name}: ${discoveredRSS}`);
              source.rssFeedUrl = discoveredRSS;
            }
          }
          return source;
        });

        return new Response(
          JSON.stringify({ sources: sourcesWithRSS.slice(0, 8) }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ sources: null }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating source suggestions:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate source suggestions',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

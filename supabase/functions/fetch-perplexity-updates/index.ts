import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const PERPLEXITY_API_KEY = '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';
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY') || 'adb3a43c30d8b7fab9c055d321a18083e9ce92794151fbcfe234d632e2e26765';
const XAI_API_KEY = Deno.env.get('XAI_API_KEY') || 'ZqcRrpHvk1HUQI4duuBhttKHN';
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const EXA_API_URL = 'https://api.exa.ai/search';

async function getExaApiKey(): Promise<string> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase.rpc('get_secret', { secret_name: 'EXA_API_KEY' });

    if (error) {
      console.error('Error fetching EXA_API_KEY:', error);
      return '';
    }

    return data || '';
  } catch (error) {
    console.error('Failed to retrieve EXA_API_KEY:', error);
    return '';
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdateResult {
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  original_url: string;
  content_type: string;
  relevance_score: number;
  relevance_reasoning?: string;
  published_at: string;
  api_source?: string;
}

async function getSocialSentiment(topics: string[], businessContext: string): Promise<string> {
  try {
    const topicsStr = topics.join(', ');
    const grokPrompt = `Search social media and online discussions about: ${topicsStr}

Business Context: ${businessContext}

Focus on finding what people are saying on social media platforms, forums, and online communities. What are the current sentiments, trends, and discussions around these topics? Look for specific predictions, concerns, or excitement from real users.`;

    const grokResponse = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        messages: [
          {
            role: 'system',
            content: 'You are a social media analyst. Search and analyze current social media discussions, trends, and sentiment. Provide specific insights from real user conversations.'
          },
          {
            role: 'user',
            content: grokPrompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!grokResponse.ok) {
      console.error(`Grok API Error: ${grokResponse.status}`);
      return '';
    }

    const grokData = await grokResponse.json();
    const grokContent = grokData.choices?.[0]?.message?.content || '';

    if (!grokContent) {
      return '';
    }

    const summaryPrompt = `Summarize the following social media sentiment analysis into 1-2 concise, specific sentences. Be specific with details like timeframes, reasons, or statistics. Avoid vague statements.

Social Media Analysis:
${grokContent}

Requirements:
- Maximum 2 sentences
- Be specific (e.g., "many social media users expect modular homes to take off in 2026 due to the increased cost of living")
- Avoid vague statements (e.g., don't just say "users love modular homes")
- Focus on actionable insights, predictions, or specific sentiment drivers
- If there are conflicting opinions, mention both briefly

Summary:`;

    const summaryResponse = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [{ role: 'user', content: summaryPrompt }],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!summaryResponse.ok) {
      console.error('Failed to generate sentiment summary');
      return '';
    }

    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices?.[0]?.message?.content?.trim() || '';

    return summary;
  } catch (error) {
    console.error('Error getting social sentiment:', error);
    return '';
  }
}

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

async function parseRSSFeed(url: string, sourceName: string): Promise<UpdateResult[]> {
  try {
    console.log(`Fetching RSS feed from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch RSS feed from ${url}: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    console.log(`RSS feed XML length: ${xmlText.length} characters`);

    const items: RSSItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;

    let itemMatch;
    while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
      const itemContent = itemMatch[1];

      const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/.exec(itemContent);
      const linkMatch = /<link><!\[CDATA\[(.*?)\]\]><\/link>|<link>(.*?)<\/link>/.exec(itemContent);
      const descMatch = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/.exec(itemContent);
      const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(itemContent);

      if (titleMatch && linkMatch) {
        items.push({
          title: titleMatch[1] || titleMatch[2] || '',
          link: linkMatch[1] || linkMatch[2] || '',
          description: descMatch ? (descMatch[1] || descMatch[2] || '') : '',
          pubDate: pubDateMatch ? pubDateMatch[1] : new Date().toISOString(),
        });
      }
    }

    console.log(`RSS feed parsed ${items.length} items from ${sourceName}`);

    const sourceUrl = new URL(url);
    const baseUrl = `${sourceUrl.protocol}//${sourceUrl.hostname}`;

    return items.slice(0, 10).map(item => {
      console.log(`RSS Article: ${item.title} - ${item.link}`);
      return {
        title: item.title,
        summary: item.description || item.title,
        source_name: sourceName,
        source_url: baseUrl,
        original_url: item.link,
        content_type: 'news',
        relevance_score: 8,
        published_at: item.pubDate,
        api_source: 'rss',
      };
    });
  } catch (error) {
    console.error(`Error parsing RSS feed from ${url}:`, error);
    return [];
  }
}

async function searchExa(
  topics: string[],
  scanOptions: ScanOptions,
  exaApiKey: string,
  businessContext: {
    description: string;
    industry: string;
    monitoringGoals: string;
    location: string;
    context: string;
  }
): Promise<UpdateResult[]> {
  if (!exaApiKey) {
    console.warn('Exa API key not available, skipping Exa search');
    return [];
  }

  try {
    console.log('=== FETCHING ARTICLES FROM EXA ===');

    const query = topics.join(' OR ');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const exaPayload = {
      query: query,
      num_results: 10,
      type: "neural",
      contents: {
        text: true,
        highlights: true
      },
      start_published_date: thirtyDaysAgo.toISOString(),
      use_autoprompt: true,
      category: "news"
    };

    console.log('Calling Exa API with query:', query);

    const exaResponse = await fetch(EXA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': exaApiKey,
      },
      body: JSON.stringify(exaPayload),
    });

    if (!exaResponse.ok) {
      console.error(`Exa API Error: ${exaResponse.status}`);
      const errorText = await exaResponse.text();
      console.error('Error response:', errorText);
      return [];
    }

    const exaData = await exaResponse.json();
    const results = exaData.results || [];

    console.log(`Exa returned ${results.length} results`);

    const exaUpdates: UpdateResult[] = [];

    for (const result of results) {
      if (!result.url || !result.url.startsWith('http')) {
        console.warn(`Skipping Exa result with invalid URL: ${result.title}`);
        continue;
      }

      const url = new URL(result.url);
      const baseUrl = `${url.protocol}//${url.hostname}`;
      const hostname = url.hostname.replace('www.', '');

      const summary = result.highlights && result.highlights.length > 0
        ? result.highlights.join(' ')
        : result.text
        ? result.text.substring(0, 300)
        : result.title;

      console.log(`Scoring Exa result: ${result.title}`);

      const { score: relevanceScore, reasoning } = await scoreArticleRelevance(
        result.title,
        topics,
        businessContext
      );

      console.log(`Exa result "${result.title}" scored: ${relevanceScore}/10 - ${reasoning}`);

      exaUpdates.push({
        title: result.title,
        summary: summary,
        source_name: result.author || hostname,
        source_url: baseUrl,
        original_url: result.url,
        content_type: 'news',
        relevance_score: relevanceScore,
        relevance_reasoning: reasoning,
        published_at: result.publishedDate || new Date().toISOString(),
        api_source: 'exa',
      });

      console.log(`Exa result: ${result.title} - ${result.url}`);
    }

    console.log(`Added ${exaUpdates.length} articles from Exa`);
    return exaUpdates;
  } catch (error) {
    console.error('Exa search failed:', error);
    return [];
  }
}

async function scoreArticleRelevance(
  title: string,
  topics: string[],
  businessContext: {
    description: string;
    industry: string;
    monitoringGoals: string;
    location: string;
    context: string;
  }
): Promise<{ score: number; reasoning: string }> {
  try {
    const prompt = `You are evaluating if a news article is DIRECTLY RELEVANT to a SPECIFIC BUSINESS, not just their industry.

BUSINESS PROFILE:
- Industry: ${businessContext.industry}
- Description: ${businessContext.description}
- Location: ${businessContext.location || 'Not specified'}
- Monitoring Goals: ${businessContext.monitoringGoals}
- Business Context: ${businessContext.context}
- Topics of Interest: ${topics.join(', ')}

ARTICLE TITLE:
"${title}"

Rate from 1-10 based on DIRECT BUSINESS IMPACT and SPECIFICITY:

9-10: CRITICAL BUSINESS IMPACT - Specific event that DIRECTLY affects THIS business
      ✓ "Bank of Canada raises interest rates by 0.5%" (if business has mortgages/loans)
      ✓ "New Ontario regulation requires modular home certifications starting 2026" (if business builds modular homes in Ontario)
      ✓ "Major competitor XYZ Corp files for bankruptcy" (if XYZ is their actual competitor)
      ✗ "Interest rates explained" (educational)
      ✗ "Modular homes gaining popularity" (industry trend, not specific impact)

7-8:  HIGH RELEVANCE - Specific event with clear implications for THIS business
      ✓ "Toronto housing permits up 15% in January 2026" (if business develops in Toronto)
      ✓ "Federal grant for green building opens Feb 1st" (if business does green building and qualifies)
      ✗ "Housing market overview" (too general)
      ✗ "Why green building is important" (educational)

5-6:  MODERATE RELEVANCE - Specific event with indirect impact on THIS business
      ✓ "National housing starts decline 12% in Q4" (affects industry, may impact business)
      ✓ "Lumber prices rise 8% due to tariffs" (if business uses lumber)
      ✗ "Construction industry trends" (too general)

3-4:  LOW RELEVANCE - Industry news but little direct business impact
      ✗ "Construction industry expected to grow 3% in 2026" (generic forecast)
      ✗ "Top 10 construction companies in Canada" (unless they're competitors)
      ✗ "Overview of building codes" (educational)

1-2:  IRRELEVANT - No direct connection to THIS business
      ✗ "How to start a construction business" (educational guide)
      ✗ "What is foreign exchange?" (completely unrelated)
      ✗ "Introduction to real estate investing" (not relevant to their specific business)

CRITICAL SCORING RULES (BE STRICT):
1. Ask: "Can this business take action or be directly impacted by this news?" If NO → score ≤4
2. Ask: "Is this about a SPECIFIC EVENT or just general information?" If general → score ≤3
3. Ask: "Does this relate to the SPECIFIC business described, or just the industry?" If just industry → score ≤5
4. Geographic relevance matters: News from irrelevant locations scores lower
5. REJECT ALL educational content, guides, "what is", "how to", explainers → score 1-3
6. REJECT broad industry trends without specific events → score 3-4
7. Only score 7+ if: (a) Specific event/announcement AND (b) Clear direct impact on THIS business

BE CONSERVATIVE: When in doubt, score LOWER. Better to miss borderline content than flood with irrelevant results.

Respond in this exact format:
Score: [number 1-10]
Reasoning: [One sentence explaining if it's specific/generic, and how it directly impacts or doesn't impact THIS specific business]

Example: "Score: 2\\nReasoning: Generic educational guide about starting a construction business with no specific events or direct relevance to their established modular home company."`;

    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.05,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.error('Failed to score article relevance');
      return { score: 3, reasoning: 'Unable to determine relevance' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'Score: 3\nReasoning: Unable to determine relevance';

    const scoreMatch = content.match(/Score:\s*(\d+)/i);
    const reasoningMatch = content.match(/Reasoning:\s*(.+)/i);

    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 3;
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Unable to determine relevance';

    return {
      score: isNaN(score) ? 3 : Math.min(Math.max(score, 1), 10),
      reasoning
    };
  } catch (error) {
    console.error('Error scoring article:', error);
    return { score: 3, reasoning: 'Error evaluating relevance' };
  }
}

interface ScanOptions {
  depth: 'quick' | 'standard' | 'thorough';
  priority: 'recent' | 'balanced' | 'comprehensive';
  maxArticles: number;
  timeRange: string;
}

interface RequestBody {
  topics: string[];
  sources?: Array<{ name: string; url: string; rss_feed_url?: string }>;
  contentTypes?: string[];
  businessDescription?: string;
  industry?: string;
  monitoringGoals?: string;
  location?: string;
  businessContext?: string;
  dateFrom?: string;
  dateTo?: string;
  scanOptions?: ScanOptions;
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
      topics,
      sources = [],
      contentTypes = ['news', 'legislation', 'government'],
      businessDescription = '',
      industry = '',
      monitoringGoals = '',
      location = '',
      businessContext = '',
      dateFrom,
      dateTo,
      scanOptions = { depth: 'standard', priority: 'balanced', maxArticles: 20, timeRange: '7days' }
    } = body;

    console.log('=== SCAN REQUEST ===');
    console.log('Topics:', topics);
    console.log('Sources:', sources.length);
    console.log('Date range:', dateFrom, 'to', dateTo);
    console.log('Scan options:', scanOptions);

    if (!topics || topics.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Topics Are Required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let updates: UpdateResult[] = [];

    const rssFeeds = sources.filter(s => s.rss_feed_url);
    console.log(`Found ${rssFeeds.length} sources with RSS feeds`);

    if (rssFeeds.length > 0) {
      console.log('=== PROCESSING RSS FEEDS ===');
      for (const source of rssFeeds) {
        const rssUpdates = await parseRSSFeed(source.rss_feed_url!, source.name);

        const filteredRssUpdates = rssUpdates.filter(u => {
          const hasValidUrl = u.original_url &&
                             u.original_url.startsWith('http') &&
                             u.original_url.length > 20;

          const isPDF = u.original_url.toLowerCase().endsWith('.pdf') ||
                       u.original_url.toLowerCase().includes('.pdf?') ||
                       u.title.toLowerCase().includes('[pdf]');

          if (!hasValidUrl) {
            console.warn(`Filtered: invalid URL for "${u.title}"`);
          }

          if (isPDF) {
            console.warn(`Filtered: PDF "${u.title}"`);
          }

          return hasValidUrl && !isPDF && u.title;
        });

        console.log(`Added ${filteredRssUpdates.length} articles from ${source.name}`);
        updates = [...updates, ...filteredRssUpdates];
      }
    }

    console.log(`RSS complete: ${updates.length} articles collected`);

    const exaApiKey = await getExaApiKey();

    console.log('=== STEP 1: FETCHING GRANTS FROM GRANTS.GOV ===');

    try {
      const grantsPayload = {
        rows: 20,
        keyword: topics.join(' '),
        oppStatuses: "forecasted|posted",
        agencies: "",
        fundingCategories: ""
      };

      console.log('Calling Grants.gov API...');
      const grantsResponse = await fetch('https://api.grants.gov/v1/api/search2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(grantsPayload),
      });

      if (grantsResponse.ok) {
        const grantsData = await grantsResponse.json();
        const grants = grantsData.data?.oppHits || [];

        console.log(`Grants.gov returned ${grants.length} opportunities`);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentGrants = grants.filter((grant: any) => {
          if (!grant.openDate) return false;

          try {
            const [month, day, year] = grant.openDate.split('/').map(Number);
            const openDate = new Date(year, month - 1, day);
            return openDate >= thirtyDaysAgo;
          } catch (error) {
            console.error(`Error parsing date ${grant.openDate}:`, error);
            return false;
          }
        });

        console.log(`Filtered to ${recentGrants.length} grants from last 30 days`);

        for (const grant of recentGrants) {
          const grantUrl = `https://www.grants.gov/search-results-detail/${grant.number}`;

          let publishedDate = new Date().toISOString();
          if (grant.openDate) {
            try {
              const [month, day, year] = grant.openDate.split('/').map(Number);
              publishedDate = new Date(year, month - 1, day).toISOString();
            } catch (error) {
              console.error(`Error parsing date ${grant.openDate}:`, error);
            }
          }

          let description = `${grant.agencyName} (${grant.agencyCode})`;
          if (grant.closeDate) {
            description += ` • Closes: ${grant.closeDate}`;
          }

          console.log(`Scoring grant: ${grant.title}`);

          const { score: relevanceScore, reasoning } = await scoreArticleRelevance(
            grant.title,
            topics,
            {
              description: businessDescription,
              industry,
              monitoringGoals,
              location,
              context: businessContext
            }
          );

          console.log(`Grant "${grant.title}" scored: ${relevanceScore}/10 - ${reasoning}`);

          updates.push({
            title: grant.title,
            summary: description,
            source_name: "Grants.gov",
            source_url: "https://www.grants.gov",
            original_url: grantUrl,
            content_type: "grant",
            relevance_score: relevanceScore,
            relevance_reasoning: reasoning,
            published_at: publishedDate,
            api_source: 'grants_gov',
          });
        }

        console.log(`Added ${recentGrants.length} grants from Grants.gov`);
      } else {
        console.error(`Grants.gov API Error: ${grantsResponse.status}`);
        const errorText = await grantsResponse.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Grants.gov request failed:', error);
    }

    console.log(`After Grants.gov: ${updates.length} results collected`);

    console.log('=== STEP 2: FETCHING REGULATIONS FROM FEDERAL REGISTER ===');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];

      const params = new URLSearchParams({
        'conditions[publication_date][gte]': dateFrom,
        'per_page': '50',
      });

      ['title', 'abstract', 'html_url', 'publication_date', 'agencies', 'type'].forEach(field => {
        params.append('fields[]', field);
      });

      ['RULE', 'PRORULE', 'NOTICE'].forEach(type => {
        params.append('conditions[type][]', type);
      });

      const federalRegisterUrl = `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`;

      console.log('Calling Federal Register API...');
      const frResponse = await fetch(federalRegisterUrl);

      if (frResponse.ok) {
        const frData = await frResponse.json();
        const documents = frData.results || [];

        console.log(`Federal Register returned ${documents.length} documents`);

        const searchTerms = [...topics, industry].filter(Boolean).map(t => t.toLowerCase());

        const relevantDocuments = documents.filter((doc: any) => {
          const searchText = `${doc.title} ${doc.abstract || ''}`.toLowerCase();
          return searchTerms.some(term => searchText.includes(term));
        });

        console.log(`Filtered to ${relevantDocuments.length} relevant regulations`);

        for (const doc of relevantDocuments) {
          const agencyNames = doc.agencies?.map((a: any) => a.name).join(', ') || 'Unknown Agency';

          let docTypeLabel = doc.type;
          if (doc.type === 'RULE') docTypeLabel = 'Final Rule';
          else if (doc.type === 'PRORULE') docTypeLabel = 'Proposed Rule';
          else if (doc.type === 'NOTICE') docTypeLabel = 'Notice';

          const description = doc.abstract || doc.title;

          let publishedDate = new Date().toISOString();
          if (doc.publication_date) {
            try {
              publishedDate = new Date(doc.publication_date).toISOString();
            } catch (error) {
              console.error(`Error parsing date ${doc.publication_date}:`, error);
            }
          }

          console.log(`Scoring regulation: ${doc.title}`);

          const { score: relevanceScore, reasoning } = await scoreArticleRelevance(
            doc.title,
            topics,
            {
              description: businessDescription,
              industry,
              monitoringGoals,
              location,
              context: businessContext
            }
          );

          console.log(`Regulation "${doc.title}" scored: ${relevanceScore}/10 - ${reasoning}`);

          updates.push({
            title: doc.title,
            summary: `${agencyNames} • ${docTypeLabel} • ${description}`,
            source_name: "Federal Register",
            source_url: "https://www.federalregister.gov",
            original_url: doc.html_url,
            content_type: "regulation",
            relevance_score: relevanceScore,
            relevance_reasoning: reasoning,
            published_at: publishedDate,
            api_source: 'federal_register',
          });
        }

        console.log(`Added ${relevantDocuments.length} regulations from Federal Register`);
      } else {
        console.error(`Federal Register API Error: ${frResponse.status}`);
        const errorText = await frResponse.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Federal Register request failed:', error);
    }

    console.log(`After Federal Register: ${updates.length} results collected`);

    console.log('=== STEP 3: FETCHING ARTICLES FROM EXA ===');

    const exaUpdates = await searchExa(
      topics,
      scanOptions,
      exaApiKey,
      {
        description: businessDescription,
        industry,
        monitoringGoals,
        location,
        context: businessContext
      }
    );
    updates = [...updates, ...exaUpdates];

    console.log(`After Exa: ${updates.length} articles collected`);

    console.log('=== STEP 3: FETCHING ARTICLE URLS FROM BING SEARCH (VIA SERPAPI) ===');

    try {
      const newsQuery = topics.map(topic => `"${topic}" (news OR announced OR announced OR update OR changes)`).join(' OR ');
      const timeFilter = scanOptions.timeRange === '24h' ? 'Day' :
                        scanOptions.timeRange === '7days' ? 'Week' :
                        scanOptions.timeRange === '30days' ? 'Month' : 'Week';

      const serpApiUrl = `https://serpapi.com/search.json?engine=bing&q=${encodeURIComponent(newsQuery)}&freshness=${timeFilter}&count=20&api_key=${SERPAPI_KEY}`;

      console.log(`Calling SerpAPI with news query: ${newsQuery} (freshness: ${timeFilter})`);

      const serpResponse = await fetch(serpApiUrl);

      if (serpResponse.ok) {
        const serpData = await serpResponse.json();
        const bingResults = serpData.organic_results || [];

        console.log(`SerpAPI returned ${bingResults.length} results from Bing`);

        for (const result of bingResults) {
          if (!result.link || !result.link.startsWith('http')) {
            console.warn(`Skipping Bing result with invalid URL: ${result.title}`);
            continue;
          }

          console.log(`Scoring Bing result: ${result.title}`);

          const { score: relevanceScore, reasoning } = await scoreArticleRelevance(
            result.title,
            topics,
            {
              description: businessDescription,
              industry,
              monitoringGoals,
              location,
              context: businessContext
            }
          );

          console.log(`Bing result "${result.title}" scored: ${relevanceScore}/10 - ${reasoning}`);

          const url = new URL(result.link);
          const baseUrl = `${url.protocol}//${url.hostname}`;

          updates.push({
            title: result.title,
            summary: result.snippet || result.title,
            source_name: result.displayed_link || url.hostname.replace('www.', ''),
            source_url: baseUrl,
            original_url: result.link,
            content_type: contentTypes.includes('news') ? 'news' : contentTypes[0] || 'news',
            relevance_score: relevanceScore,
            relevance_reasoning: reasoning,
            published_at: result.date || new Date().toISOString(),
            api_source: 'bing',
          });
        }

        console.log(`Added ${bingResults.length} articles from Bing Search`);
      } else {
        console.error(`SerpAPI Error: ${serpResponse.status}`);
        const errorText = await serpResponse.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('SerpAPI request failed:', error);
    }

    console.log('=== STEP 4: FETCHING ARTICLE URLS FROM PERPLEXITY ===');

    const topicsQuery = topics.join(' OR ');
    const sourcesHint = sources.length > 0
      ? `Focus on these sources: ${sources.map(s => s.name).join(', ')}.`
      : '';

    const timeRangeText = scanOptions.timeRange === '24h' ? 'from the last 24 hours' :
                         scanOptions.timeRange === '7days' ? 'from the last 7 days' :
                         scanOptions.timeRange === '30days' ? 'from the last 30 days' : '';

    const priorityInstruction = scanOptions.priority === 'recent'
      ? 'Prioritize the MOST RECENT breaking news and developments published today or yesterday.'
      : scanOptions.priority === 'comprehensive'
      ? 'Prioritize comprehensive, in-depth articles about specific events and developments.'
      : 'Balance recency with article quality and specificity.';

    const depthInstruction = scanOptions.depth === 'thorough'
      ? 'Search thoroughly across multiple sources and viewpoints for specific events.'
      : scanOptions.depth === 'quick'
      ? 'Focus on top mainstream sources for quick results about specific events.'
      : '';

    const numArticles = Math.min(scanOptions.maxArticles, 50);

    const urlPrompt = `Search for ${numArticles} SPECIFIC news articles about recent events, announcements, and developments related to: ${topicsQuery}

Time period: ${timeRangeText}
${priorityInstruction}
${depthInstruction}

Business Context: ${businessDescription ? businessDescription : 'General'}
Industry: ${industry || 'General'}
Location: ${location || 'Global'}
Monitoring Goals: ${monitoringGoals || 'General updates'}

${sourcesHint}

CRITICAL REQUIREMENTS - Only include articles that are:
1. SPECIFIC EVENTS: Breaking news, announcements, policy changes, specific incidents
   ✓ GOOD: "Company X announces $50M expansion in Toronto", "New regulation passed requiring Y"
   ✗ BAD: "Guide to foreign exchange rates", "Overview of modular homes"

2. RECENT & ACTIONABLE: Recent developments that could impact the business
   ✓ GOOD: "Tesla stock drops 15% after CEO announcement", "Federal government launches $2B grant program"
   ✗ BAD: "What are modular homes?", "Introduction to cryptocurrency"

3. DIRECTLY RELEVANT: Must directly relate to the business's industry, location, or monitoring goals
   ✓ GOOD: Articles about specific market changes, competitor moves, regulatory updates
   ✗ BAD: General educational content, tangentially related news

DO NOT INCLUDE:
- General guides or "how-to" articles
- Educational overviews or explainers
- Articles that just mention keywords in passing
- Outdated news or evergreen content
- Crime stories unless directly impacting the business
- Generic industry news without specific events

Focus on: Specific announcements, breaking developments, policy changes, market movements, competitor actions, regulatory updates, funding announcements, mergers/acquisitions, specific incidents.`;

    try {
      console.log('Calling Perplexity for URLs...');
      const urlResponse = await fetch(PERPLEXITY_API_URL, {
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
              content: 'You are a news research assistant. Search the web and cite your sources.'
            },
            {
              role: 'user',
              content: urlPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2000,
          return_citations: true,
          return_images: false,
        }),
      });

      if (!urlResponse.ok) {
        console.error(`Perplexity API Error: ${urlResponse.status}`);
        const errorText = await urlResponse.text();
        console.error('Error response:', errorText);
      } else {
        const urlData = await urlResponse.json();
        const content = urlData.choices?.[0]?.message?.content || '';
        const citations = urlData.citations || [];

        console.log('Perplexity response summary:', content.substring(0, 200));
        console.log(`Perplexity returned ${citations.length} citations`);

        if (citations && citations.length > 0) {
          for (const citationUrl of citations) {
            if (!citationUrl || !citationUrl.startsWith('http')) {
              console.warn(`Skipping invalid citation URL: ${citationUrl}`);
              continue;
            }

            try {
              const url = new URL(citationUrl);

              const urlLower = citationUrl.toLowerCase();
              const isGenericSite = genericFederalSites.some(site => {
                const normalizedUrl = urlLower.replace('https://', '').replace('http://', '');
                return normalizedUrl === site || (normalizedUrl.startsWith(site + '/') && normalizedUrl.split('/').length <= 4);
              });

              if (isGenericSite) {
                console.log(`Skipping generic site: ${citationUrl}`);
                continue;
              }

              const hostname = url.hostname.replace('www.', '');
              const pathParts = url.pathname.split('/').filter(p => p.length > 0);

              let title = pathParts[pathParts.length - 1] || hostname;
              title = title
                .replace(/-/g, ' ')
                .replace(/_/g, ' ')
                .replace(/\.\w+$/, '')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');

              console.log(`Processing citation: ${title} - ${citationUrl}`);

              const { score: relevanceScore, reasoning } = await scoreArticleRelevance(
                title,
                topics,
                {
                  description: businessDescription,
                  industry,
                  monitoringGoals,
                  location,
                  context: businessContext
                }
              );

              console.log(`Citation "${title}" scored: ${relevanceScore}/10`);

              const baseUrl = `${url.protocol}//${url.hostname}`;

              updates.push({
                title: title,
                summary: `Article from ${hostname}`,
                source_name: hostname,
                source_url: baseUrl,
                original_url: citationUrl,
                content_type: contentTypes.includes('news') ? 'news' : contentTypes[0] || 'news',
                relevance_score: relevanceScore,
                relevance_reasoning: reasoning,
                published_at: new Date().toISOString(),
                api_source: 'perplexity',
              });
            } catch (urlError) {
              console.error(`Error processing citation URL: ${citationUrl}`, urlError);
            }
          }

          console.log(`Processed ${updates.length} articles from Perplexity citations`);
        } else {
          console.error('No citations found in Perplexity response');
        }
      }
    } catch (error) {
      console.error('Perplexity request failed:', error);
    }

    const genericFederalSites = [
      'www.usa.gov/laws-and-regulations',
      'www.regulations.gov',
      'www.govinfo.gov/app/collection/cfr',
      'www.ecfr.gov',
      'www.federalregister.gov'
    ];

    const urlSet = new Set<string>();

    const deduplicatedUpdates = updates.filter(update => {
      if (urlSet.has(update.original_url)) {
        console.log(`Deduplicated: ${update.title}`);
        return false;
      }

      const urlLower = update.original_url.toLowerCase();
      const isGenericFederalSite = genericFederalSites.some(site => {
        const normalizedUrl = urlLower.replace('https://', '').replace('http://', '');
        return normalizedUrl === site || normalizedUrl.startsWith(site + '/') && normalizedUrl.split('/').length <= 4;
      });

      if (isGenericFederalSite) {
        console.log(`Filtered generic federal site: ${update.title} - ${update.original_url}`);
        return false;
      }

      urlSet.add(update.original_url);
      return true;
    });

    deduplicatedUpdates.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) {
        return b.relevance_score - a.relevance_score;
      }
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });

    const finalUpdates = deduplicatedUpdates.slice(0, scanOptions.maxArticles);

    console.log(`=== FINAL RESULT: ${finalUpdates.length} articles (limited from ${deduplicatedUpdates.length}) ===`);
    finalUpdates.forEach((u, i) => {
      console.log(`${i + 1}. [${u.api_source}] [Score: ${u.relevance_score}/10] ${u.title} - ${u.original_url}`);
    });

    console.log('=== FETCHING SOCIAL SENTIMENT ===');
    const businessContextStr = [businessDescription, industry, businessContext].filter(Boolean).join(' - ');
    const socialSentiment = await getSocialSentiment(topics, businessContextStr);
    console.log('Social sentiment:', socialSentiment);

    return new Response(
      JSON.stringify({
        updates: finalUpdates,
        socialSentiment: socialSentiment,
        searchesPerformed: sources.length,
        totalFound: updates.length,
        afterDeduplication: deduplicatedUpdates.length,
        returned: finalUpdates.length
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
        error: 'Failed To Fetch Updates',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

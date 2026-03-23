import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const XAI_API_KEY = Deno.env.get('XAI_API_KEY') || 'ZqcRrpHvk1HUQI4duuBhttKHN';
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Article {
  title: string;
  summary: string;
  source_name: string;
  original_url: string;
  relevance_score: number;
  relevance_reasoning?: string;
}

interface RequestBody {
  articles: Article[];
  contentType: string;
  businessContext?: {
    description: string;
    industry: string;
    monitoringGoals: string;
  };
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
    const { articles, contentType, businessContext } = body;

    if (!articles || articles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No articles provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Generating summary for ${articles.length} ${contentType} articles`);

    const contentTypeLabels: Record<string, string> = {
      'news': 'News Articles',
      'grants': 'Grant Opportunities',
      'legislation': 'Legislation & Regulations',
      'government': 'Government Updates',
      'reports': 'Industry Reports',
      'press': 'Press Releases',
      'competitor': 'Competitor News',
    };

    const label = contentTypeLabels[contentType] || contentType;

    const articlesText = articles.map((article, idx) => {
      return `[${idx + 1}] "${article.title}" from ${article.source_name}
Summary: ${article.summary}
Relevance: ${article.relevance_score}/10${article.relevance_reasoning ? ` - ${article.relevance_reasoning}` : ''}
URL: ${article.original_url}`;
    }).join('\n\n');

    const businessContextText = businessContext
      ? `\n\nBUSINESS CONTEXT:
- Industry: ${businessContext.industry}
- Description: ${businessContext.description}
- Monitoring Goals: ${businessContext.monitoringGoals}`
      : '';

    const prompt = `You are an expert business analyst synthesizing ${label.toLowerCase()} for a specific business.

${articlesText}${businessContextText}

Your task is to create a comprehensive summary of these ${articles.length} articles with the following structure:

1. ONE-SENTENCE OVERVIEW
   - Write ONE clear sentence (15-25 words) summarizing what was found across all articles
   - Keep it simple and direct - what's the main takeaway?
   - Use plain language, avoid jargon

2. KEY INSIGHTS (3-5 bullet points maximum)
   CRITICAL REQUIREMENTS FOR EACH INSIGHT:
   - Name the SPECIFIC thing from the article (e.g., "The Federal Reserve's G-5A report", "New EV tax credit", "Grant for agriculture businesses")
   - Explain HOW it helps their business using their actual industry and monitoring goals
   - Keep it simple and direct - use plain language
   - Each insight should be 1-2 sentences maximum

   GOOD EXAMPLE: "The Federal Reserve's G-5A report on foreign exchange rates helps your FX trading business make better currency decisions and manage risk."

   BAD EXAMPLE: "The Federal Reserve's G-5A report on foreign exchange rates is critical for Blackheath's strategic planning in the FX market because their business focuses on currency trading and requires authoritative data to inform trading strategies and risk management decisions."

3. DETAILED SUMMARY (2-3 paragraphs)
   - Explain the overall findings in simple terms
   - Show why it matters to their specific business
   - Use their industry, monitoring goals, and business description
   - Write clearly - avoid complex business jargon

Format your response EXACTLY like this:

OVERVIEW:
[One clear sentence summarizing the main findings]

KEY INSIGHTS:
- [First insight - name specific thing and explain how it helps their business]
- [Second insight - name specific thing and explain how it helps their business]
- [Third insight - name specific thing and explain how it helps their business]

SUMMARY:
[First paragraph explaining the findings in simple terms]

[Second paragraph explaining why it matters to their specific business]

[Optional third paragraph with additional context]

IMPORTANT:
- Use simple, direct language - avoid jargon and complex terms
- Every insight must name a specific thing (report, legislation, grant, etc.)
- Every insight must explain the impact using their actual business context
- Keep sentences short and clear
- Write like you're explaining to someone without technical expertise`;

    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error('xAI API error:', await response.text());
      return new Response(
        JSON.stringify({ error: 'Failed to generate summary' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const overviewMatch = content.match(/OVERVIEW:([\s\S]*?)(?=KEY INSIGHTS:|$)/i);
    const keyInsightsMatch = content.match(/KEY INSIGHTS:([\s\S]*?)(?=SUMMARY:|$)/i);
    const summaryMatch = content.match(/SUMMARY:([\s\S]*?)$/i);

    const overviewText = overviewMatch ? overviewMatch[1].trim() : '';
    const keyInsightsText = keyInsightsMatch ? keyInsightsMatch[1].trim() : '';
    const summaryText = summaryMatch ? summaryMatch[1].trim() : content;

    const keyInsights = keyInsightsText
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);

    const citations = articles.map((article, idx) => ({
      number: idx + 1,
      title: article.title,
      url: article.original_url,
      source: article.source_name,
    }));

    console.log(`Generated summary with ${keyInsights.length} key insights`);

    return new Response(
      JSON.stringify({
        overview: overviewText,
        summary_text: summaryText,
        key_insights: keyInsights,
        citations: citations,
        article_count: articles.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating topic summary:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SourceWithUrl {
  title: string;
  url: string;
}

interface ResearchTopic {
  topic: string;
  context: string;
  research: string;
  keyInsights: string[];
  sources: SourceWithUrl[];
  newSources?: SourceWithUrl[];
  hasNewSources?: boolean;
  socialSentiment?: string;
}

async function getSocialSentiment(topic: string, businessContext: string): Promise<string> {
  try {
    const grokPrompt = `Search social media and online discussions about: ${topic}

Business Context: ${businessContext}

Focus on finding what people are saying on social media platforms, forums, and online communities. What are the current sentiments, trends, and discussions around this topic? Look for specific predictions, concerns, or excitement from real users.`;

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { profileId, topics, depth = 'standard' } = await req.json();

    if (!profileId || !topics || topics.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Profile ID and topics are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const topicsList = Array.isArray(topics)
      ? topics.map(t => typeof t === 'string' ? { topic: t, tags: [] } : t)
      : [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_description, industry, monitoring_goals, location_country, location_province, location_city, business_context')
      .eq('id', profileId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const locationStr = [profile.location_city, profile.location_province, profile.location_country]
      .filter(Boolean)
      .join(', ');

    const businessContext = Array.isArray(profile.business_context)
      ? profile.business_context
      : [];

    const { data: sourcePerformance } = await supabase
      .from('source_performance')
      .select('source_name, source_url, average_rating, total_ratings')
      .eq('profile_id', profileId)
      .order('average_rating', { ascending: false });

    const highRatedSources = (sourcePerformance || [])
      .filter(s => s.average_rating >= 4 && s.total_ratings >= 2)
      .map(s => s.source_name)
      .slice(0, 10);

    const lowRatedSources = (sourcePerformance || [])
      .filter(s => s.average_rating <= 2 && s.total_ratings >= 2)
      .map(s => s.source_name)
      .slice(0, 10);

    const researchResults: ResearchTopic[] = [];

    for (const topicItem of topicsList.slice(0, 5)) {
      const topic = typeof topicItem === 'string' ? topicItem : topicItem.topic;
      const tags = typeof topicItem === 'object' && Array.isArray(topicItem.tags) ? topicItem.tags : [];

      const prompt = `Generate comprehensive background research on the following topic for a business:

Topic: ${topic}

Business Profile:
- Industry: ${profile.industry}
- Description: ${profile.business_description}
${locationStr ? `- Location: ${locationStr}` : ''}
${businessContext.length > 0 ? `- Context: ${businessContext.join(', ')}` : ''}
${profile.monitoring_goals ? `- Monitoring Goals: ${profile.monitoring_goals}` : ''}

Source Preferences:
${highRatedSources.length > 0 ? `- PRIORITIZE information from these trusted sources: ${highRatedSources.join(', ')}` : ''}
${lowRatedSources.length > 0 ? `- AVOID using information from these sources: ${lowRatedSources.join(', ')}` : ''}

Task: Provide a comprehensive background research report that includes:
1. Current state of this topic in the relevant industry and location
2. Recent developments and trends (last 6-12 months)
3. Key players, organizations, or authorities involved
4. Relevant regulations or policies
5. Practical implications for this specific business
6. Future outlook and potential changes

Format the response as a well-structured research summary. Include specific facts, dates, and statistics where applicable.

Return your response in the following JSON format:
{
  "context": "Brief 2-3 sentence overview of the topic",
  "research": "Comprehensive research summary (4-6 paragraphs)",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3", "Insight 4", "Insight 5"],
  "sources": [
    {"title": "Article or source title", "url": "https://example.com/article"},
    {"title": "Another source title", "url": "https://example.com/source"}
  ]
}

IMPORTANT: The sources array MUST contain objects with "title" and "url" fields. The url MUST be a valid, clickable hyperlink to the actual article or source.`;

      try {
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
                content: 'You are an expert research analyst providing comprehensive background information on topics relevant to businesses. Provide detailed, factual research with specific examples and sources. Return only valid JSON.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.5,
          }),
        });

        if (!perplexityResponse.ok) {
          console.error(`Perplexity API Error for topic "${topic}": ${perplexityResponse.status}`);
          continue;
        }

        const perplexityData = await perplexityResponse.json();
        const content = perplexityData.choices?.[0]?.message?.content || '';

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error(`Failed to parse response for topic "${topic}"`);
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Get previous research for this topic to compare sources
        const { data: previousResearch } = await supabase
          .from('research_history')
          .select('sources')
          .eq('profile_id', profileId)
          .eq('topic', topic)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const currentSources: SourceWithUrl[] = Array.isArray(parsed.sources)
          ? parsed.sources.filter((s: any) => s && s.title && s.url)
          : [];

        let newSources: SourceWithUrl[] = [];
        let hasNewSources = false;

        if (previousResearch && Array.isArray(previousResearch.sources)) {
          const previousUrls = new Set(
            previousResearch.sources.map((s: any) => s.url).filter(Boolean)
          );
          newSources = currentSources.filter(s => !previousUrls.has(s.url));
          hasNewSources = newSources.length > 0;
        } else {
          newSources = currentSources;
          hasNewSources = true;
        }

        const businessContextStr = [
          profile.business_description,
          profile.industry,
          businessContext.join(', ')
        ].filter(Boolean).join(' - ');

        const socialSentiment = await getSocialSentiment(topic, businessContextStr);

        const researchData = {
          topic,
          context: parsed.context || '',
          research: parsed.research || '',
          keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
          sources: currentSources,
          newSources,
          hasNewSources,
          socialSentiment,
        };

        researchResults.push(researchData);

        // Save to research history
        await supabase.from('research_history').insert({
          profile_id: profileId,
          topic,
          research_data: {
            context: researchData.context,
            research: researchData.research,
            keyInsights: researchData.keyInsights,
          },
          sources: currentSources,
          tags: tags,
        });

      } catch (error) {
        console.error(`Error processing topic "${topic}":`, error);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ research: researchResults }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate background research',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

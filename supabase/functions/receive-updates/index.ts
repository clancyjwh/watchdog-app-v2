import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const XAI_API_KEY = Deno.env.get('XAI_API_KEY') || 'ZqcRrpHvk1HUQI4duuBhttKHN';
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type ArticleUpdate = {
  title: string;
  content: string;
  sourceUrl: string;
  originalUrl: string;
  timestamp: string;
  relevance_score?: number;
  relevance_reasoning?: string;
  content_type?: string;
  source_name?: string;
  source_id?: string;
};

type IncomingPayload = {
  userId: string;
  updates: ArticleUpdate[];
  isManualScan?: boolean;
};

async function callXAI(prompt: string, temperature: number = 0.3): Promise<string> {
  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature,
      }),
    });

    if (!response.ok) {
      console.error('xAI API error:', response.status);
      return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error calling xAI:', error);
    return '';
  }
}

async function scoreRelevance(
  article: ArticleUpdate,
  userProfile: any
): Promise<{ score: number; reasoning: string }> {
  const topics = userProfile.topics?.map((t: any) => t.topic_name).join(', ') || '';
  const contentTypes = userProfile.content_types?.join(', ') || '';

  const prompt = `
User Profile:
- Business: ${userProfile.business_description}
- Topics: ${topics}
- Content Types: ${contentTypes}

Article:
Title: ${article.title}
Content: ${article.content.substring(0, 2000)}

Task: Rate this article's relevance to the user's interests on a scale of 1-10.
Consider topic alignment, content type match, and business relevance.
Return ONLY a JSON object: {"score": X, "reasoning": "brief explanation"}
`;

  try {
    const response = await callXAI(prompt, 0.3);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { score: parsed.score || 5, reasoning: parsed.reasoning || '' };
    }
  } catch (error) {
    console.error('Error scoring relevance:', error);
  }

  return { score: 5, reasoning: 'Unable to score' };
}

async function generateSummary(content: string): Promise<string> {
  const prompt = `
Summarize this article in exactly 2-3 sentences for a busy professional.
Focus on key facts and actionable insights.

Article: ${content.substring(0, 3000)}
`;

  try {
    const response = await callXAI(prompt, 0.5);
    return response || content.substring(0, 200);
  } catch (error) {
    console.error('Error generating summary:', error);
    return content.substring(0, 200);
  }
}

async function classifyContentType(article: ArticleUpdate): Promise<string> {
  const prompt = `
Classify this article into ONE of these categories:
- news: Breaking news, current events, industry news
- legislation: Laws, regulations, policy changes, compliance
- grants: Grant opportunities, funding announcements, RFPs
- reports: Research papers, industry reports, white papers, studies
- press: Press releases, company announcements
- government: Government updates, official statements, public notices
- competitor: Competitor news, product launches, business moves

Article:
Title: ${article.title}
Content: ${article.content.substring(0, 1500)}

Return ONLY the category name (e.g., "news" or "legislation"), nothing else.
`;

  try {
    const response = await callXAI(prompt, 0.2);
    const category = response.trim().toLowerCase();

    const validCategories = ['news', 'legislation', 'grants', 'reports', 'press', 'government', 'competitor'];
    if (validCategories.includes(category)) {
      return category;
    }
  } catch (error) {
    console.error('Error classifying content:', error);
  }

  return 'news';
}

function getDeliveryBatch(frequency: string, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (frequency) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly':
      const weekNumber = getWeekNumber(date);
      return `${year}-w${String(weekNumber).padStart(2, '0')}`;
    case 'monthly':
      return `${year}-${month}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: IncomingPayload = await req.json();
    const { userId, updates, isManualScan } = payload;

    console.log(`Received ${updates.length} updates for user ${userId}, isManualScan: ${isManualScan}`);

    const { data: profiles, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*, topics(*), subscriptions(*)')
      .eq('user_id', userId)
      .single();

    if (profileError || !profiles) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found', details: profileError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profile = profiles;
    const subscription = profile.subscriptions?.[0];
    const resultsPerScan = profile.results_per_scan || 10;
    const frequency = subscription?.frequency || 'weekly';
    const deliveryBatch = isManualScan
      ? `Manual Scan - ${new Date().toISOString()}`
      : getDeliveryBatch(frequency);

    const allProcessedUpdates = [];

    for (const update of updates) {
      const hasPreScore = update.relevance_score !== undefined;
      const hasPreSummary = update.content && update.content.length < 500;
      const hasPreContentType = update.content_type !== undefined;

      const [relevanceResult, summary, contentType] = await Promise.all([
        hasPreScore ? Promise.resolve({ score: update.relevance_score, reasoning: update.relevance_reasoning || '' }) : scoreRelevance(update, profile),
        hasPreSummary ? Promise.resolve(update.content) : generateSummary(update.content),
        hasPreContentType ? Promise.resolve(update.content_type) : classifyContentType(update),
      ]);

      allProcessedUpdates.push({
        profile_id: profile.id,
        title: update.title,
        summary,
        relevance_score: relevanceResult.score,
        relevance_reasoning: relevanceResult.reasoning,
        source_name: update.source_name || new URL(update.sourceUrl).hostname.replace('www.', ''),
        source_url: update.sourceUrl,
        original_url: update.originalUrl,
        content_type: contentType,
        delivery_batch: deliveryBatch,
        published_at: update.timestamp,
        source_id: update.source_id || null,
        is_read: false,
        is_saved: false,
      });
    }

    allProcessedUpdates.sort((a, b) => b.relevance_score - a.relevance_score);
    const processedUpdates = allProcessedUpdates.slice(0, resultsPerScan);

    if (processedUpdates.length > 0) {
      // Check for existing updates to prevent duplicates
      const urls = processedUpdates.map(u => u.original_url);
      const { data: existingUpdates } = await supabaseClient
        .from('updates')
        .select('original_url')
        .eq('profile_id', profile.id)
        .in('original_url', urls);

      const existingUrls = new Set((existingUpdates || []).map(u => u.original_url));

      // Filter out duplicates
      const newUpdates = processedUpdates.filter(u => {
        if (existingUrls.has(u.original_url)) {
          console.log(`Skipping duplicate update: ${u.title} - ${u.original_url}`);
          return false;
        }
        return true;
      });

      console.log(`Inserting ${newUpdates.length} new updates (filtered ${processedUpdates.length - newUpdates.length} duplicates)`);

      if (newUpdates.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('updates')
          .insert(newUpdates);

        if (insertError) {
          console.error('Error inserting updates:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to save updates', details: insertError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: updates.length,
        saved: processedUpdates.length,
        filtered: updates.length - processedUpdates.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing updates:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message, stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

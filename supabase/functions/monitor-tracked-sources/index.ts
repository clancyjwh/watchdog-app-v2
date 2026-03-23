import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const XAI_API_KEY = Deno.env.get('XAI_API_KEY') || 'ZqcRrpHvk1HUQI4duuBhttKHN';
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Source {
  id: string;
  profile_id: string;
  name: string;
  url: string;
  description: string;
}

interface ChangeAnalysis {
  isMeaningful: boolean;
  changeType: 'requirement_added' | 'requirement_removed' | 'requirement_modified' | 'exemption_added' | 'wording_only' | 'other';
  summary: string;
  relevanceScore: number;
}

async function callXAI(messages: Array<{role: string, content: string}>, temperature: number = 0.3): Promise<string> {
  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages,
        temperature,
      }),
    });

    if (!response.ok) {
      console.error('xAI API error:', response.status, await response.text());
      return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error calling xAI:', error);
    return '';
  }
}

function extractMainContent(html: string): string {
  let content = html;

  const tagsToRemove = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<style[^>]*>[\s\S]*?<\/style>/gi,
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<aside[^>]*>[\s\S]*?<\/aside>/gi,
    /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  ];

  for (const regex of tagsToRemove) {
    content = content.replace(regex, ' ');
  }

  content = content.replace(/<[^>]+>/g, ' ');
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&#39;/g, "'");
  content = content.replace(/\s+/g, ' ');
  content = content.trim();

  return content;
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function findChangedSections(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split(/[.!?]\s+/).filter(l => l.trim().length > 20);
  const newLines = newContent.split(/[.!?]\s+/).filter(l => l.trim().length > 20);

  const oldSet = new Set(oldLines.map(l => l.trim().toLowerCase()));
  const newSet = new Set(newLines.map(l => l.trim().toLowerCase()));

  const added = newLines.filter(l => !oldSet.has(l.trim().toLowerCase()));
  const removed = oldLines.filter(l => !newSet.has(l.trim().toLowerCase()));

  let changes = '';
  if (added.length > 0) {
    changes += `ADDED CONTENT:\n${added.slice(0, 10).join('. ')}\n\n`;
  }
  if (removed.length > 0) {
    changes += `REMOVED CONTENT:\n${removed.slice(0, 10).join('. ')}\n\n`;
  }

  return changes || 'Minor changes detected';
}

async function analyzeChange(
  sourceName: string,
  sourceUrl: string,
  oldContent: string,
  newContent: string,
  businessDescription: string,
  topics: string[]
): Promise<ChangeAnalysis | null> {
  const changedSections = findChangedSections(oldContent, newContent);

  const prompt = `You are analyzing a change to a regulatory or informational page that a business is monitoring.

Source: ${sourceName}
URL: ${sourceUrl}
Business: ${businessDescription}
Topics of interest: ${topics.join(', ')}

CHANGES DETECTED:
${changedSections.substring(0, 3000)}

Analyze these changes and determine:
1. Is this a MEANINGFUL change that the business should be alerted about?
   - Meaningful: requirements added/removed/modified, exemptions added, deadlines changed, procedures updated
   - NOT meaningful: typo fixes, formatting changes, minor wording adjustments with no substantive impact

2. If meaningful, what type of change is it?
   - requirement_added: A new requirement or obligation was introduced
   - requirement_removed: A requirement or obligation was removed
   - requirement_modified: An existing requirement was changed (relaxed, narrowed, or clarified)
   - exemption_added: A new exemption or special case was introduced
   - other: Other meaningful change

3. How relevant is this change to the business (1-10)?

4. Provide a clear, concise summary (1-2 sentences) of what changed and why it matters.

Return ONLY valid JSON:
{
  "isMeaningful": true/false,
  "changeType": "requirement_added" | "requirement_removed" | "requirement_modified" | "exemption_added" | "wording_only" | "other",
  "summary": "Brief summary of the change",
  "relevanceScore": 8
}`;

  try {
    const response = await callXAI([
      { role: 'system', content: 'You are an expert at analyzing regulatory and policy changes. Be conservative - only flag truly meaningful changes.' },
      { role: 'user', content: prompt }
    ], 0.2);

    if (!response) return null;

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const analysis = JSON.parse(jsonMatch[0]);
    return analysis;
  } catch (error) {
    console.error('Error analyzing change:', error);
    return null;
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

    const { profileId, isManualScan } = await req.json();

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: 'Profile ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deliveryBatch = isManualScan
      ? `Manual Scan - ${new Date().toISOString()}`
      : '';

    console.log(`Monitoring tracked sources for profile: ${profileId}`);

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_description, industry')
      .eq('id', profileId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: topics } = await supabase
      .from('topics')
      .select('topic_name')
      .eq('profile_id', profileId);

    const topicNames = topics?.map(t => t.topic_name) || [];

    const { data: sources } = await supabase
      .from('sources')
      .select('*')
      .eq('profile_id', profileId)
      .eq('is_core_source', true);

    if (!sources || sources.length === 0) {
      console.log('No tracked sources found');
      return new Response(
        JSON.stringify({ message: 'No tracked sources to monitor', updatesCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${sources.length} tracked sources to monitor`);

    const detectedUpdates = [];

    for (const source of sources) {
      try {
        console.log(`Fetching content from ${source.url}`);

        const fetchResponse = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OpticonBot/1.0)',
          },
        });

        if (!fetchResponse.ok) {
          console.error(`Failed to fetch ${source.url}: ${fetchResponse.status}`);
          continue;
        }

        const html = await fetchResponse.text();
        const mainContent = extractMainContent(html);
        const contentHash = await hashContent(mainContent);

        console.log(`Extracted ${mainContent.length} characters from ${source.name}`);

        const { data: previousSnapshot } = await supabase
          .from('source_snapshots')
          .select('*')
          .eq('source_id', source.id)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!previousSnapshot) {
          console.log(`No previous snapshot for ${source.name}, creating initial snapshot`);
          await supabase.from('source_snapshots').insert({
            source_id: source.id,
            content_text: mainContent,
            content_hash: contentHash,
            snapshot_date: new Date().toISOString(),
          });
          continue;
        }

        if (previousSnapshot.content_hash === contentHash) {
          console.log(`No changes detected for ${source.name}`);
          continue;
        }

        console.log(`Changes detected in ${source.name}, analyzing...`);

        const analysis = await analyzeChange(
          source.name,
          source.url,
          previousSnapshot.content_text,
          mainContent,
          profile.business_description,
          topicNames
        );

        if (!analysis || !analysis.isMeaningful || analysis.relevanceScore < 5) {
          console.log(`Changes in ${source.name} are not meaningful or relevant enough`);

          await supabase.from('source_snapshots').insert({
            source_id: source.id,
            content_text: mainContent,
            content_hash: contentHash,
            snapshot_date: new Date().toISOString(),
          });
          continue;
        }

        console.log(`Detected meaningful update for ${source.name}: ${analysis.summary}`);

        detectedUpdates.push({
          title: `Update: ${source.name}`,
          summary: analysis.summary,
          source_name: source.name,
          source_url: source.url,
          original_url: source.url,
          content_type: 'legislation',
          relevance_score: analysis.relevanceScore,
          relevance_reasoning: `Change type: ${analysis.changeType}`,
          published_at: new Date().toISOString(),
          api_source: 'monitor',
          source_id: source.id,
        });

        await supabase.from('source_snapshots').insert({
          source_id: source.id,
          content_text: mainContent,
          content_hash: contentHash,
          snapshot_date: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error monitoring source ${source.name}:`, error);
      }
    }

    console.log(`Monitoring complete. Detected ${detectedUpdates.length} updates.`);

    return new Response(
      JSON.stringify({
        success: true,
        sourcesMonitored: sources.length,
        updates: detectedUpdates,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to monitor tracked sources',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

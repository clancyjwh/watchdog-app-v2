import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Company {
  id: string;
  user_id: string;
  name: string;
  industry: string;
  description: string;
  monitoring_goals: string;
  location_country: string;
  location_province: string;
  location_city: string;
  business_context: any;
  subscription_frequency: string;
  content_types: string[];
  results_per_scan: number;
}

interface Profile {
  id: string;
  email: string;
  delivery_preferences: any;
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('=== CHECKING FOR COMPANIES DUE FOR AUTOMATED SCANS ===');

    // Find all companies where next_scan_due_date is now or in the past
    const { data: dueCompanies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .lte('next_scan_due_date', new Date().toISOString())
      .not('subscription_frequency', 'is', null);

    if (companiesError) {
      console.error('Error fetching due companies:', companiesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch companies', details: companiesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!dueCompanies || dueCompanies.length === 0) {
      console.log('No companies due for automated scans at this time');
      return new Response(
        JSON.stringify({ message: 'No companies due for scans', scansRun: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${dueCompanies.length} companies due for automated scans`);

    const scanResults = [];

    for (const company of dueCompanies as Company[]) {
      console.log(`\n=== RUNNING AUTOMATED SCAN FOR: ${company.name} ===`);

      try {
        // Get profile for this company
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, delivery_preferences')
          .eq('user_id', company.user_id)
          .maybeSingle();

        if (!profile) {
          console.error(`No profile found for company ${company.name}`);
          continue;
        }

        // Get topics for this company
        const { data: topics } = await supabase
          .from('topics')
          .select('topic_name')
          .eq('company_id', company.id);

        if (!topics || topics.length === 0) {
          console.log(`No topics configured for ${company.name}, skipping scan`);
          continue;
        }

        const topicNames = topics.map(t => t.topic_name);

        // Get sources for this company
        const { data: sources } = await supabase
          .from('sources')
          .select('name, url, rss_feed_url')
          .eq('company_id', company.id)
          .eq('is_core_source', true);

        const sourcesData = sources || [];

        // Calculate date range based on frequency
        const today = new Date().toISOString().split('T')[0];
        const dateFromObj = new Date();

        switch (company.subscription_frequency) {
          case 'weekly':
            dateFromObj.setDate(dateFromObj.getDate() - 7);
            break;
          case 'biweekly':
            dateFromObj.setDate(dateFromObj.getDate() - 14);
            break;
          case 'monthly':
            dateFromObj.setDate(dateFromObj.getDate() - 30);
            break;
          default:
            dateFromObj.setDate(dateFromObj.getDate() - 7);
        }

        const dateFrom = dateFromObj.toISOString().split('T')[0];

        const location = [company.location_city, company.location_province, company.location_country]
          .filter(Boolean)
          .join(', ');

        const businessContext = Array.isArray(company.business_context)
          ? company.business_context.join(', ')
          : '';

        // Call fetch-perplexity-updates to run the scan
        console.log(`Calling fetch-perplexity-updates for ${company.name}`);
        const scanResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-perplexity-updates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topics: topicNames,
            sources: sourcesData,
            contentTypes: company.content_types || ['news', 'legislation', 'government'],
            businessDescription: company.description || '',
            industry: company.industry || '',
            monitoringGoals: company.monitoring_goals || '',
            location,
            businessContext,
            dateFrom,
            dateTo: today,
            scanOptions: {
              depth: 'standard',
              priority: 'balanced',
              maxArticles: company.results_per_scan || 10,
              timeRange: company.subscription_frequency === 'weekly' ? '7days' :
                         company.subscription_frequency === 'biweekly' ? '14days' : '30days'
            }
          }),
        });

        if (!scanResponse.ok) {
          console.error(`Scan failed for ${company.name}: ${scanResponse.status}`);
          continue;
        }

        const scanData = await scanResponse.json();
        console.log(`Scan completed for ${company.name}: ${scanData.updates?.length || 0} updates found`);

        if (!scanData.updates || scanData.updates.length === 0) {
          console.log(`No updates found for ${company.name}`);

          // Still update the last scan date
          await supabase
            .from('companies')
            .update({ last_automated_scan_date: new Date().toISOString() })
            .eq('id', company.id);

          continue;
        }

        // Group updates by content type
        const articlesByContentType: Record<string, any[]> = {};
        scanData.updates.forEach((update: any) => {
          const contentType = update.content_type || 'news';
          if (!articlesByContentType[contentType]) {
            articlesByContentType[contentType] = [];
          }
          articlesByContentType[contentType].push(update);
        });

        const scanDate = new Date().toISOString();

        // Generate summaries for each content type
        for (const [contentType, articles] of Object.entries(articlesByContentType)) {
          console.log(`Generating summary for ${articles.length} ${contentType} articles`);

          const summaryResponse = await fetch(`${supabaseUrl}/functions/v1/generate-topic-summary`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              articles,
              topics: topicNames,
              businessContext: {
                description: company.description,
                industry: company.industry,
                goals: company.monitoring_goals,
                location,
                context: businessContext
              },
              contentType,
            }),
          });

          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();

            await supabase.from('scan_summaries').insert({
              profile_id: profile.id,
              company_id: company.id,
              scan_date: scanDate,
              content_type: contentType,
              summary: summaryData.summary,
              overview: summaryData.overview,
              key_insights: summaryData.keyInsights,
              citations: articles.map((a: any) => ({
                title: a.title,
                url: a.original_url,
                source: a.source_name,
                published_at: a.published_at
              })),
              article_count: articles.length,
              social_sentiment: scanData.socialSentiment || null,
            });

            console.log(`Saved scan summary for ${contentType} (${articles.length} articles)`);
          } else {
            console.error(`Failed to generate summary for ${contentType}`);
          }
        }

        // Update last scan date and reschedule for 7 days in the future
        const nextScanDate = new Date();
        nextScanDate.setDate(nextScanDate.getDate() + 7);
        
        await supabase
          .from('companies')
          .update({ 
            last_automated_scan_date: scanDate,
            next_scan_due_date: nextScanDate.toISOString()
          })
          .eq('id', company.id);

        // Deliver updates if user has delivery preferences
        if (profile.delivery_preferences) {
          const deliveryPrefs = profile.delivery_preferences as any;

          if (deliveryPrefs.methods && Array.isArray(deliveryPrefs.methods)) {
            for (const method of deliveryPrefs.methods) {
              console.log(`Delivering updates via ${method} to ${profile.email}`);

              await fetch(`${supabaseUrl}/functions/v1/send-delivery-updates`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  profile_id: profile.id,
                  updates: scanData.updates.slice(0, company.results_per_scan || 10),
                  medium: method,
                }),
              });
            }
          }
        }

        scanResults.push({
          company: company.name,
          updatesFound: scanData.updates.length,
          status: 'success'
        });

      } catch (error) {
        console.error(`Error running scan for ${company.name}:`, error);
        scanResults.push({
          company: company.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log(`\n=== AUTOMATED SCANS COMPLETE ===`);
    console.log(`Scans attempted: ${dueCompanies.length}`);
    console.log(`Scans successful: ${scanResults.filter(r => r.status === 'success').length}`);

    return new Response(
      JSON.stringify({
        message: 'Automated scans completed',
        companiesProcessed: dueCompanies.length,
        results: scanResults
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in run-scheduled-scans:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to run scheduled scans',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ScanSummary } from '../lib/supabase';
import {
  Activity, Search, ExternalLink, LogOut, Settings, CreditCard,
  BarChart3, Heart, Zap, Monitor, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFrequencyLabel } from '../utils/pricing';
import SourceRelevanceRating from '../components/SourceRelevanceRating';

export default function RealTimeScans() {
  const { user, profile, refreshProfile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [scanSummaries, setScanSummaries] = useState<ScanSummary[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const contentTypeLabels: Record<string, string> = {
    'news': 'News Articles',
    'grant': 'Grant Opportunities',
    'grants': 'Grant Opportunities',
    'regulation': 'Regulatory Changes',
    'legislation': 'Legislation & Regulations',
    'government': 'Government Updates',
    'reports': 'Industry Reports',
    'press': 'Press Releases',
    'competitor': 'Competitor News',
  };

  const loadScanSummaries = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('scan_summaries')
      .select('*')
      .eq('profile_id', profile.id)
      .order('scan_date', { ascending: false });

    if (error) {
      console.error('Error loading scan summaries:', error);
      return;
    }

    if (data) {
      console.log(`Loaded ${data.length} scan summaries for profile ${profile.id}`);
      const summariesWithSentiment = data.filter(s => s.social_sentiment).length;
      console.log(`  ${summariesWithSentiment} summaries have social sentiment`);
      setScanSummaries(data);
    }
  };

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadScanSummaries();
    }
  }, [profile?.id, authLoading]);

  // Auto-expand the most recent scan
  useEffect(() => {
    if (scanSummaries.length > 0 && expandedDates.size === 0) {
      const mostRecentDate = scanSummaries[0].scan_date;
      setExpandedDates(new Set([mostRecentDate]));
    }
  }, [scanSummaries]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const runManualScan = async () => {
    if (!profile?.id || !user?.id) {
      alert('Unable to run scan. Please refresh the page and try again.');
      return;
    }

    setScanLoading(true);

    try {
      const { data: newBalance, error: spendError } = await supabase
        .rpc('spend_manual_scan_credits', { cost: 25 });

      if (spendError) {
        alert('Not enough credits. Please upgrade or purchase more credits.');
        setScanLoading(false);
        return;
      }

      await refreshProfile();
      console.log(`Credits spent. New balance: ${newBalance}`);
      const [topicsRes, sourcesRes] = await Promise.all([
        supabase
          .from('topics')
          .select('*')
          .eq('profile_id', profile.id),
        supabase
          .from('sources')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('is_core_source', true)
      ]);

      const topics = topicsRes.data?.map(t => t.topic_name) || [];
      const sources = sourcesRes.data || [];

      if (topics.length === 0) {
        alert('Please configure your topics in Settings before running a scan.');
        setScanLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const dateFromObj = new Date();
      dateFromObj.setDate(dateFromObj.getDate() - 7);
      const dateFrom = dateFromObj.toISOString().split('T')[0];

      // Get user's session token for authenticated edge function calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Session expired. Please log in again.');
        setScanLoading(false);
        return;
      }

      const promises = [
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-perplexity-updates`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topics,
            sources: sources.map(s => ({
              name: s.name,
              url: s.url,
              rss_feed_url: s.rss_feed_url
            })),
            contentTypes: profile.content_types || ['news', 'legislation', 'government'],
            businessDescription: profile.business_description || '',
            industry: profile.industry || '',
            monitoringGoals: profile.monitoring_goals || '',
            location: [profile.location_city, profile.location_province, profile.location_country].filter(Boolean).join(', '),
            businessContext: Array.isArray(profile.business_context) ? profile.business_context.join(', ') : '',
            dateFrom,
            dateTo: today,
            scanOptions: {
              depth: 'standard',
              priority: 'balanced',
              maxArticles: profile.results_per_scan || 10,
              timeRange: '7days'
            }
          }),
        })
      ];

      if (sources.length > 0) {
        promises.push(
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monitor-tracked-sources`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ profileId: profile.id, isManualScan: true }),
          })
        );
      }

      const responses = await Promise.all(promises);

      const allUpdates: any[] = [];
      let socialSentiment = '';

      if (responses[0]?.ok) {
        const perplexityData = await responses[0].json();
        console.log('Perplexity response:', perplexityData);
        if (perplexityData.updates && perplexityData.updates.length > 0) {
          console.log(`Got ${perplexityData.updates.length} updates from Perplexity`);
          allUpdates.push(...perplexityData.updates);
        }
        if (perplexityData.socialSentiment) {
          socialSentiment = perplexityData.socialSentiment;
          console.log('Social sentiment:', socialSentiment);
        }
      } else {
        console.error('Perplexity request failed:', responses[0]?.status, await responses[0]?.text());
      }

      if (responses[1] && responses[1].ok) {
        const monitorData = await responses[1].json();
        console.log('Monitor response:', monitorData);
        if (monitorData.updates && monitorData.updates.length > 0) {
          console.log(`Got ${monitorData.updates.length} updates from Monitor`);
          allUpdates.push(...monitorData.updates);
        }
      }

      console.log(`Total updates collected: ${allUpdates.length}`);

      if (allUpdates.length === 0) {
        alert('No updates found. Try adjusting your topics or sources in Settings.');
        setScanLoading(false);
        return;
      }

      // Get all previously found article URLs to avoid duplicates
      const { data: existingSummaries } = await supabase
        .from('scan_summaries')
        .select('citations')
        .eq('profile_id', profile.id);

      const previouslyFoundUrls = new Set<string>();
      if (existingSummaries) {
        existingSummaries.forEach(summary => {
          if (summary.citations && Array.isArray(summary.citations)) {
            summary.citations.forEach((citation: any) => {
              if (citation.url) {
                previouslyFoundUrls.add(citation.url);
              }
            });
          }
        });
      }

      console.log(`Found ${previouslyFoundUrls.size} previously discovered article URLs`);

      // Filter out articles we've already found
      const newUpdates = allUpdates.filter(update => !previouslyFoundUrls.has(update.original_url));

      console.log(`After deduplication: ${newUpdates.length} new articles (removed ${allUpdates.length - newUpdates.length} duplicates)`);

      if (newUpdates.length === 0) {
        console.warn('No new articles after deduplication. This should not happen with SERP and Perplexity.');
      }

      const scanDate = new Date().toISOString();

      const articlesByContentType: Record<string, any[]> = {};
      newUpdates.forEach(update => {
        const contentType = update.content_type || 'news';
        if (!articlesByContentType[contentType]) {
          articlesByContentType[contentType] = [];
        }
        articlesByContentType[contentType].push(update);
      });

      console.log(`Grouped ${newUpdates.length} new articles into ${Object.keys(articlesByContentType).length} content types`);

      const summaryPromises = Object.entries(articlesByContentType).map(async ([contentType, articles]) => {
        console.log(`Generating summary for ${articles.length} ${contentType} articles`);

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-topic-summary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            articles: articles.map(a => ({
              title: a.title,
              summary: a.summary,
              source_name: a.source_name,
              original_url: a.original_url,
              relevance_score: a.relevance_score,
              relevance_reasoning: a.relevance_reasoning
            })),
            contentType,
            businessContext: {
              description: profile.business_description || '',
              industry: profile.industry || '',
              monitoringGoals: profile.monitoring_goals || ''
            }
          }),
        });

        if (!response.ok) {
          console.error(`Failed to generate summary for ${contentType}:`, await response.text());
          return null;
        }

        const summaryData = await response.json();
        console.log(`Generated summary for ${contentType} with ${summaryData.key_insights.length} insights`);

        const { error: insertError } = await supabase
          .from('scan_summaries')
          .insert({
            profile_id: profile.id,
            content_type: contentType,
            overview: summaryData.overview || null,
            summary_text: summaryData.summary_text,
            key_insights: summaryData.key_insights,
            citations: summaryData.citations,
            article_count: summaryData.article_count,
            social_sentiment: socialSentiment || null,
            scan_date: scanDate,
            is_read: false
          });

        if (insertError) {
          console.error(`Error saving summary for ${contentType}:`, insertError);
          return null;
        }

        return contentType;
      });

      const results = await Promise.all(summaryPromises);
      const successCount = results.filter(r => r !== null).length;

      console.log(`Successfully created ${successCount} summaries`);

      setTimeout(() => {
        loadScanSummaries();
      }, 500);

      alert(`Scan complete! Found ${newUpdates.length} articles across ${successCount} topics.`);
    } catch (error) {
      console.error('Scan error:', error);
      alert('Failed to run scan. Please try again.');
    } finally {
      setScanLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' });
  };

  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  // Flatten all citations from all scan summaries into individual article cards
  interface ArticleCard {
    id: string;
    title: string;
    summary: string;
    whyItMatters: string;
    date: string;
    url: string;
    contentType: string;
    sourceName: string;
    sourceId: string;
    socialSentiment?: string;
    scanSummaryId: string;
  }

  // Helper to extract source name from URL
  const getSourceNameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      return hostname;
    } catch {
      return url;
    }
  };

  const articleCards: ArticleCard[] = [];
  scanSummaries.forEach((summary) => {
    if (summary.citations && summary.citations.length > 0) {
      summary.citations.forEach((citation, idx) => {
        // Use key insights as "why it matters" if available
        const whyItMatters = summary.key_insights && summary.key_insights[idx]
          ? summary.key_insights[idx]
          : summary.overview || '';

        const sourceName = getSourceNameFromUrl(citation.url);

        articleCards.push({
          id: `${summary.id}-${citation.number}`,
          title: citation.title,
          summary: summary.overview || summary.summary_text || 'No summary available',
          whyItMatters,
          date: summary.scan_date,
          url: citation.url,
          contentType: summary.content_type,
          sourceName: sourceName,
          sourceId: sourceName,
          socialSentiment: summary.social_sentiment || undefined,
          scanSummaryId: summary.id
        });
      });
    }
  });

  // Group articles by scan date
  const articlesByDate: Record<string, { articles: ArticleCard[], socialSentiment?: string }> = {};
  articleCards.forEach((article) => {
    const dateKey = article.date;
    if (!articlesByDate[dateKey]) {
      articlesByDate[dateKey] = { articles: [], socialSentiment: article.socialSentiment };
    }
    articlesByDate[dateKey].articles.push(article);
    // Update social sentiment if it exists (all articles from same scan have same sentiment)
    if (article.socialSentiment && !articlesByDate[dateKey].socialSentiment) {
      articlesByDate[dateKey].socialSentiment = article.socialSentiment;
    }
  });

  // Log social sentiment status for debugging
  Object.entries(articlesByDate).forEach(([date, { socialSentiment }]) => {
    console.log(`Date ${date}: Social sentiment ${socialSentiment ? 'available' : 'not available'}`);
    if (socialSentiment) {
      console.log(`  Content: "${socialSentiment}"`);
    }
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mb-4"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex h-screen overflow-hidden">
        <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-5 h-5 text-gray-900" />
              <h1 className="text-lg font-bold text-gray-900">WatchDog AI</h1>
            </div>

            <div className="bg-white border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{profile?.company_name || 'User'}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">{getFrequencyLabel(profile?.subscription_frequency || 'weekly')}</p>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-0.5">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 font-medium"
            >
              <BarChart3 className="w-4 h-4" />
              Updates
            </button>
            <button
              onClick={() => navigate('/scans')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-900 text-white font-medium"
            >
              <Zap className="w-4 h-4" />
              Research
            </button>
            <button
              onClick={() => navigate('/tracked-sources')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 font-medium"
            >
              <Monitor className="w-4 h-4" />
              Monitored Sources
            </button>
            <button
              onClick={() => navigate('/archive')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 font-medium"
            >
              <Heart className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 font-medium"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => navigate('/billing')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 font-medium"
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </button>
          </nav>

          <div className="p-3 border-t border-gray-200">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-white border-b border-gray-200 px-6 py-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Research</h1>
                <p className="text-sm text-gray-600">
                  Comprehensive insights and analysis on your monitoring topics
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={runManualScan}
                  disabled={scanLoading || (profile?.manual_scan_credits ?? 0) < 25}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {scanLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Run Manual Scan
                    </>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-600 font-medium">Credits: {profile?.manual_scan_credits ?? 0}</p>
                  {(profile?.manual_scan_credits ?? 0) < 25 && (
                    <button
                      onClick={() => navigate('/billing')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                    >
                      Buy Credits
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">AI scanning the web for background research (25 credits per scan)</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-6 max-w-6xl mx-auto">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">
                      Research Scan Guidelines
                    </h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>
                        Scanning too frequently returns stale results. Wait several days between scans for fresh, valuable insights.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {articleCards.length === 0 ? (
                <div className="bg-white border border-gray-200 p-12 text-center max-w-2xl mx-auto">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 mb-4">
                    <Search className="w-7 h-7 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No research scans performed</h3>
                  <p className="text-sm text-gray-600">
                    Run a manual scan to get comprehensive insights from your monitored sources and topics.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(articlesByDate)
                    .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
                    .map(([date, { articles, socialSentiment }]) => {
                      const isExpanded = expandedDates.has(date);
                      return (
                        <div key={date} className="bg-white border border-gray-200">
                          <button
                            onClick={() => toggleDateExpansion(date)}
                            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                                {new Date(date).getDate()}
                              </div>
                              <div className="text-left">
                                <h3 className="text-xl font-bold text-gray-900">
                                  {formatDateFull(date)}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {articles.length} article{articles.length !== 1 ? 's' : ''} found
                                  {socialSentiment && ' • Social sentiment available'}
                                </p>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-6 h-6 text-gray-400 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-6 h-6 text-gray-400 flex-shrink-0" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="border-t border-gray-200 p-6 space-y-6">
                              {articles.map((article, index) => (
                                <div
                                  key={article.id}
                                  className="bg-gray-50 border border-gray-200 p-8 shadow-sm"
                                >
                                  <h2 className="text-2xl font-bold text-gray-900 mb-6 leading-tight">
                                    {article.title}
                                  </h2>

                                  <div className="mb-6">
                                    <p className="text-sm font-bold text-gray-900 mb-2">Summary:</p>
                                    <p className="text-base text-gray-700 leading-relaxed">
                                      {article.summary}
                                    </p>
                                  </div>

                                  {article.whyItMatters && (
                                    <div className="mb-6">
                                      <p className="text-sm font-bold text-gray-900 mb-2">Why it matters:</p>
                                      <p className="text-base text-gray-700 leading-relaxed">
                                        {article.whyItMatters}
                                      </p>
                                    </div>
                                  )}

                                  <div className="mb-6">
                                    <SourceRelevanceRating
                                      sourceId={article.sourceId}
                                      sourceName={article.sourceName}
                                      updateId={article.id}
                                      onSourceBlocked={() => loadScanSummaries()}
                                    />
                                  </div>

                                  <div className="pt-4 border-t border-gray-200">
                                    <a
                                      href={article.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                                    >
                                      <FileText className="w-4 h-4" />
                                      Read Full Article
                                    </a>
                                  </div>

                                  {index === articles.length - 1 && socialSentiment && (
                                    <div className="mt-6 pt-6 border-t border-gray-300">
                                      <div className="bg-amber-50 border border-amber-200 p-6">
                                        <div className="flex items-start gap-3">
                                          <Activity className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                          <div className="flex-1">
                                            <h3 className="text-lg font-bold text-gray-900 mb-1">Social Sentiment</h3>
                                            <p className="text-xs text-amber-700 font-medium mb-3">
                                              Based on social media consensus - supplementary information
                                            </p>
                                            <p className="text-base text-gray-700 leading-relaxed">
                                              {socialSentiment}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

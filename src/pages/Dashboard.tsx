import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Update, Subscription } from '../lib/supabase';
import {
  Activity, Search, LogOut, Settings, CreditCard,
  BarChart3, Zap, Filter, Heart, Trash2, Monitor, FileText,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getNextDeliveryDate, formatNextDeliveryDate, getFrequencyLabel } from '../utils/pricing';
import SourceRelevanceRating from '../components/SourceRelevanceRating';
import ContentTag from '../components/ContentTag';
import ResultCard from '../components/ResultCard';

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [updates, setUpdates] = useState<Update[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedContentType, setSelectedContentType] = useState<string>('all');
  const [minRelevance, setMinRelevance] = useState(1);
  const [sortBy, setSortBy] = useState<'newest' | 'relevance'>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [sourcePreferences, setSourcePreferences] = useState<Map<string, number>>(new Map());
  const [blockedSources, setBlockedSources] = useState<Set<string>>(new Set());
  const [monitoredSourceUrls, setMonitoredSourceUrls] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    if (!profile?.id || !user?.id) return;

    try {
      const [updatesResponse, subscriptionResponse, preferencesResponse, blockedResponse, sourcesResponse] = await Promise.all([
        supabase
          .from('updates')
          .select('*')
          .eq('profile_id', profile.id)
          .not('delivery_batch', 'like', 'Manual Scan%')
          .order('published_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('profile_id', profile.id)
          .maybeSingle(),
        supabase
          .from('source_feedback')
          .select('source_id, rating, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_blocked_sources')
          .select('source_id')
          .eq('user_id', user.id),
        supabase
          .from('sources')
          .select('id, url, rss_feed_url, is_core_source')
          .eq('profile_id', profile.id)
          .eq('is_core_source', true)
          .not('rss_feed_url', 'is', null)
          .neq('rss_feed_url', ''),
      ]);

      setUpdates(updatesResponse.data || []);
      setSubscription(subscriptionResponse.data);

      // Build set of monitored source URLs (sources with RSS feeds that are actively monitored)
      const monitored = new Set<string>();
      if (sourcesResponse.data) {
        sourcesResponse.data.forEach(source => {
          try {
            const url = new URL(source.url);
            const hostname = url.hostname.replace('www.', '');
            monitored.add(hostname);
          } catch {
            monitored.add(source.url);
          }
        });
      }
      setMonitoredSourceUrls(monitored);

      // Calculate preference scores (average of last 10 ratings per source)
      const prefs = new Map<string, number>();
      const sourceRatings = new Map<string, number[]>();

      if (preferencesResponse.data) {
        preferencesResponse.data.forEach(feedback => {
          if (!sourceRatings.has(feedback.source_id)) {
            sourceRatings.set(feedback.source_id, []);
          }
          const ratings = sourceRatings.get(feedback.source_id)!;
          if (ratings.length < 10) {
            ratings.push(feedback.rating);
          }
        });

        sourceRatings.forEach((ratings, sourceId) => {
          const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
          prefs.set(sourceId, avg);
        });
      }

      setSourcePreferences(prefs);

      // Build blocked sources set
      const blocked = new Set<string>();
      if (blockedResponse.data) {
        blockedResponse.data.forEach(item => blocked.add(item.source_id));
      }
      setBlockedSources(blocked);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleFavourite = async (updateId: string, currentlyFavourite: boolean) => {
    try {
      await supabase
        .from('updates')
        .update({ is_favourite: !currentlyFavourite })
        .eq('id', updateId);

      setUpdates(prev => prev.map(u =>
        u.id === updateId ? { ...u, is_favourite: !currentlyFavourite } : u
      ));
    } catch (error) {
      console.error('Error toggling favourite:', error);
    }
  };

  const deleteUpdate = async (updateId: string) => {
    try {
      await supabase
        .from('updates')
        .delete()
        .eq('id', updateId);

      setUpdates(prev => prev.filter(u => u.id !== updateId));
    } catch (error) {
      console.error('Error deleting update:', error);
    }
  };

  const markAsRead = async (updateId: string) => {
    try {
      await supabase
        .from('updates')
        .update({ is_read: true })
        .eq('id', updateId);

      setUpdates(prev => prev.map(u =>
        u.id === updateId ? { ...u, is_read: true } : u
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const getContentTypeLabel = (contentType: string) => {
    const labels: Record<string, string> = {
      news: 'News',
      legislation: 'Legislation',
      regulation: 'Regulation',
      grant: 'Grant',
      grants: 'Grant',
      reports: 'Report',
      press: 'Press Release',
      government: 'Government',
      competitor: 'Competitor',
    };
    return labels[contentType] || contentType;
  };

  // Helper function to get source_id from an update (use source_url as canonical identifier)
  const getSourceId = (update: Update) => {
    try {
      const url = new URL(update.source_url);
      return url.hostname.replace('www.', '');
    } catch {
      return update.source_url;
    }
  };

  // Helper function to calculate adjusted relevance score
  const getAdjustedRelevance = (update: Update) => {
    const sourceId = getSourceId(update);
    const preferenceScore = sourcePreferences.get(sourceId) || 3.0; // neutral default
    const multiplier = 0.5 + (preferenceScore / 5); // maps 1->0.7, 3->1.1, 5->1.5
    return update.relevance_score * multiplier;
  };

  // Helper function to check if update is from AI-discovered source (not monitored)
  const isAIDiscoveredSource = (update: Update) => {
    // AI-discovered sources are those NOT actively monitored via RSS feeds
    // Check if the update's source_url matches any monitored source
    try {
      const url = new URL(update.source_url);
      const hostname = url.hostname.replace('www.', '');
      return !monitoredSourceUrls.has(hostname);
    } catch {
      // If can't parse URL, check raw source_url
      return !monitoredSourceUrls.has(update.source_url);
    }
  };

  let filteredUpdates = updates.filter((update) => {
    // Filter out blocked sources
    const sourceId = getSourceId(update);
    if (blockedSources.has(sourceId)) {
      return false;
    }

    const matchesSearch =
      searchQuery === '' ||
      update.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      update.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRelevance = update.relevance_score >= minRelevance;
    const matchesSource = selectedSource === 'all' || update.source_name === selectedSource;
    const matchesContentType = selectedContentType === 'all' || update.content_type === selectedContentType;

    return matchesSearch && matchesRelevance && matchesSource && matchesContentType;
  });

  if (sortBy === 'relevance') {
    filteredUpdates = [...filteredUpdates].sort((a, b) =>
      getAdjustedRelevance(b) - getAdjustedRelevance(a)
    );
  } else {
    filteredUpdates = [...filteredUpdates].sort((a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  }

  const unreadCount = updates.filter(u => !u.is_read).length;
  const sources = Array.from(new Set(updates.map(u => u.source_name).filter(Boolean)));
  const contentTypes = Array.from(new Set(updates.map(u => u.content_type).filter(Boolean)));
  const frequency = subscription?.frequency || 'weekly';
  const nextDelivery = getNextDeliveryDate(frequency);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mb-4"></div>
          <p className="text-sm text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex h-screen overflow-hidden">
        {/* Left Sidebar */}
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
              <p className="text-xs text-gray-500">{getFrequencyLabel(frequency)}</p>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-0.5">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-900 text-white font-medium"
            >
              <BarChart3 className="w-4 h-4" />
              General Updates
            </button>
            <button
              onClick={() => navigate('/scans')}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 font-medium"
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

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-5">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">General Updates</h1>
            <p className="text-sm text-gray-600 mb-4">
              AI-powered discovery feed showing news, legislation, and updates relevant to your business.
            </p>

            {unreadCount > 0 && (
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-semibold text-gray-900">{unreadCount} new update{unreadCount !== 1 ? 's' : ''}</span> since your last visit
              </p>
            )}

            {/* Collapsible Filter Bar */}
            <div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors mb-3"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {showFilters ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {showFilters && (
                  <div className="flex items-center gap-2 pb-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search updates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <select
                      value={selectedSource}
                      onChange={(e) => setSelectedSource(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Sources</option>
                      {sources.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>

                    <select
                      value={selectedContentType}
                      onChange={(e) => setSelectedContentType(e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">All Types</option>
                      {contentTypes.map(type => (
                        <option key={type} value={type}>{getContentTypeLabel(type)}</option>
                      ))}
                    </select>

                    <select
                      value={minRelevance}
                      onChange={(e) => setMinRelevance(Number(e.target.value))}
                      className="px-3 py-2 text-sm border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="1">All Scores</option>
                      <option value="5">5+ Score</option>
                      <option value="7">7+ Score</option>
                      <option value="9">9+ Score</option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'newest' | 'relevance')}
                      className="px-3 py-2 text-sm border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="newest">Newest</option>
                      <option value="relevance">Highest Score</option>
                    </select>
                  </div>
                )}
              </div>
          </div>

          {/* Updates List */}
          <div className="flex-1 overflow-auto bg-gray-50">
              <div className="p-6 max-w-6xl mx-auto">
                {filteredUpdates.length === 0 ? (
                  <div className="bg-white border border-gray-200 p-12 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 mb-4">
                      <Activity className="w-7 h-7 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {updates.length === 0 ? 'No updates yet' : 'No matching updates'}
                    </h3>
                    <p className="text-sm text-gray-600 max-w-md mx-auto mb-2">
                      {updates.length === 0
                        ? (subscription?.first_update_date === new Date().toISOString().split('T')[0]
                          ? 'Your first scan is being generated right now. This may take a few minutes. Check the Research tab to see background insights.'
                          : 'Your monitoring will begin within 24 hours of completing setup.')
                        : 'Try adjusting your search or filters to see more results.'}
                    </p>
                    {updates.length === 0 && (
                      <>
                        {subscription?.first_update_date === new Date().toISOString().split('T')[0] ? (
                          <div className="flex items-center justify-center gap-3 mt-6">
                            <button
                              onClick={() => navigate('/scans')}
                              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
                            >
                              <Zap className="w-4 h-4" />
                              View Research
                            </button>
                            <button
                              onClick={() => loadData()}
                              className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
                            >
                              Refresh Updates
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-900 mt-6 mb-2">
                              Next scheduled update:
                            </p>
                            <p className="text-blue-600 font-semibold">
                              {formatNextDeliveryDate(nextDelivery)}
                            </p>
                            <div className="flex items-center justify-center gap-3 mt-6">
                              <button
                                onClick={() => navigate('/settings')}
                                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                              >
                                View Settings
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredUpdates.map((update) => (
                      <ResultCard
                        key={update.id}
                        id={update.id}
                        title={update.title}
                        summary={update.summary}
                        url={update.original_url || update.url}
                        source={update.source_name}
                        date={update.published_at}
                        relevanceScore={update.relevance_score || 0}
                        relevanceReasoning={update.relevance_reasoning || ''}
                        contentType={update.content_type}
                        isFavourite={update.is_favourite || false}
                        onToggleFavourite={(e) => {
                          e.stopPropagation();
                          toggleFavourite(update.id, !!update.is_favourite);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>
    </div>
  );
}

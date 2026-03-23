import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Update } from '../lib/supabase';
import {
  Activity, Search, LogOut, Settings, CreditCard,
  BarChart3, Zap, Filter, Heart, Trash2, Monitor, FileText, Archive as ArchiveIcon, ChevronDown, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFrequencyLabel } from '../utils/pricing';
import StarRating from '../components/StarRating';
import CompanySwitcher from '../components/CompanySwitcher';
import ContentTag from '../components/ContentTag';

export default function Archive() {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [updates, setUpdates] = useState<Update[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [minRelevance, setMinRelevance] = useState(1);
  const [sortBy, setSortBy] = useState<'newest' | 'relevance-high' | 'relevance-low'>('newest');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadArchive();
    }
  }, [profile?.id, authLoading]);

  const loadArchive = async () => {
    if (!profile?.id) return;

    try {
      const response = await supabase
        .from('updates')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('is_saved', true)
        .order('published_at', { ascending: false });

      setUpdates(response.data || []);
    } catch (error) {
      console.error('Error loading archive:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleSaveUpdate = async (updateId: string) => {
    try {
      await supabase
        .from('updates')
        .update({ is_saved: false })
        .eq('id', updateId);

      setUpdates(prev => prev.filter(u => u.id !== updateId));
    } catch (error) {
      console.error('Error removing from archive:', error);
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
      grants: 'Grant',
      reports: 'Report',
      press: 'Press Release',
      government: 'Government',
      competitor: 'Competitor',
    };
    return labels[contentType] || contentType;
  };

  const filterUpdates = (updatesToFilter: Update[]) => {
    return updatesToFilter.filter((update) => {
      const matchesSearch =
        searchQuery === '' ||
        update.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        update.summary.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRelevance = update.relevance_score >= minRelevance;
      const matchesSource = selectedSource === 'all' || update.source_name === selectedSource;

      return matchesSearch && matchesRelevance && matchesSource;
    });
  };

  const sortUpdates = (updatesToSort: Update[]) => {
    if (sortBy === 'relevance-high') {
      return [...updatesToSort].sort((a, b) => b.relevance_score - a.relevance_score);
    } else if (sortBy === 'relevance-low') {
      return [...updatesToSort].sort((a, b) => a.relevance_score - b.relevance_score);
    } else {
      return [...updatesToSort].sort((a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    }
  };

  const filteredUpdates = sortUpdates(filterUpdates(updates));
  const sources = Array.from(new Set(updates.map(u => u.source_name).filter(Boolean)));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' });
  };

  const unreadCount = updates.filter(u => !u.is_read).length;

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
        {/* Left Sidebar */}
        <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-5 h-5 text-gray-900" />
              <h1 className="text-lg font-bold text-gray-900">WatchDog AI</h1>
            </div>

            <div className="bg-white border border-gray-200 p-3">
              <div className="mb-2">
                <CompanySwitcher />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 bg-gray-900 flex items-center justify-center text-white text-xs font-bold">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">{user?.email}</p>
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
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-900 text-white font-medium"
            >
              <ArchiveIcon className="w-4 h-4" />
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
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Archive</h2>
                {unreadCount > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold text-gray-900">{unreadCount} unread</span> article{unreadCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

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
                      placeholder="Search articles..."
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
                    onChange={(e) => setSortBy(e.target.value as 'newest' | 'relevance-high' | 'relevance-low')}
                    className="px-3 py-2 text-sm border border-gray-300 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="newest">Most Recent</option>
                    <option value="relevance-high">Relevance: High to Low</option>
                    <option value="relevance-low">Relevance: Low to High</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-auto bg-gray-50">
            <div className="p-6 max-w-6xl mx-auto">
              {filteredUpdates.length === 0 ? (
                <div className="bg-white border border-gray-200 p-12 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 mb-4">
                    <ArchiveIcon className="w-7 h-7 text-gray-400" />
                  </div>
                  <h3 className="text-base text-gray-900 mb-2">
                    {updates.length === 0 ? 'No archived articles yet' : 'No matching results'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {updates.length === 0
                      ? 'Articles you save will appear here.'
                      : 'Try adjusting your filters to see more results.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredUpdates.map((update) => (
                    <div
                      key={update.id}
                      className="bg-white border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h2 className="text-2xl font-bold text-gray-900 leading-tight flex-1">
                          {update.title}
                        </h2>
                        {update.content_type && (
                          <ContentTag contentType={update.content_type} size="md" />
                        )}
                      </div>

                      <div className="mb-6">
                        <p className="text-sm font-bold text-gray-900 mb-2">Summary:</p>
                        <p className="text-base text-gray-700 leading-relaxed">
                          {update.summary}
                        </p>
                      </div>

                      {update.relevance_reasoning && (
                        <div className="mb-6">
                          <p className="text-sm font-bold text-gray-900 mb-2">Why it matters:</p>
                          <p className="text-base text-gray-700 leading-relaxed">
                            {update.relevance_reasoning}
                          </p>
                        </div>
                      )}

                      <div className="mb-6">
                        <StarRating
                          sourceUrl={update.source_url}
                          sourceName={update.source_name}
                          updateId={update.id}
                          size="md"
                        />
                      </div>

                      <div className="mb-6">
                        <p className="text-sm font-bold text-gray-900 mb-1">Date:</p>
                        <p className="text-base text-gray-700">{formatDate(update.published_at)}</p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <a
                          href={update.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          Read Full Article
                        </a>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleSaveUpdate(update.id)}
                            className="p-2 text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove from Archive"
                          >
                            <Heart className="w-5 h-5 fill-current" />
                          </button>
                          <button
                            onClick={() => deleteUpdate(update.id)}
                            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                            title="Remove article"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
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

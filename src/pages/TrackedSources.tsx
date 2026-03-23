import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Activity, LogOut, Settings, CreditCard, BarChart3, Heart, Zap,
  ExternalLink, AlertCircle, CheckCircle, Clock, Monitor, ChevronRight, Plus, X, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFrequencyLabel } from '../utils/pricing';

interface Source {
  id: string;
  name: string;
  url: string;
  description: string;
  rss_feed_url: string;
  is_core_source: boolean;
  created_at: string;
}

interface SourceSnapshot {
  id: string;
  source_id: string;
  content_text: string;
  content_hash: string;
  snapshot_date: string;
  created_at: string;
}

export default function TrackedSources() {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [sources, setSources] = useState<Source[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, SourceSnapshot[]>>({});
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalLoading, setAddModalLoading] = useState(false);
  const [suggestedSources, setSuggestedSources] = useState<any[]>([]);
  const [customSourceName, setCustomSourceName] = useState('');
  const [customSourceUrl, setCustomSourceUrl] = useState('');
  const [customSourceDescription, setCustomSourceDescription] = useState('');
  const [selectedChangeDetail, setSelectedChangeDetail] = useState<{snapshot: SourceSnapshot, previousSnapshot: SourceSnapshot} | null>(null);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadData();
    }
  }, [profile?.id, authLoading]);

  useEffect(() => {
    if (selectedSource && profile?.id) {
      loadSnapshots(selectedSource.id);
    }
  }, [selectedSource, profile]);

  const loadData = async () => {
    if (!profile?.id) return;

    try {
      const [sourcesResponse, subscriptionResponse] = await Promise.all([
        supabase
          .from('sources')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('is_core_source', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('profile_id', profile.id)
          .maybeSingle(),
      ]);

      const sourcesData = sourcesResponse.data || [];
      setSources(sourcesData);
      setSubscription(subscriptionResponse.data);

      if (sourcesData.length > 0 && !selectedSource) {
        setSelectedSource(sourcesData[0]);
      }
    } catch (error) {
      console.error('Error loading monitored sources:', error);
    }
  };

  const loadSnapshots = async (sourceId: string) => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('source_snapshots')
        .select('*')
        .eq('source_id', sourceId)
        .order('snapshot_date', { ascending: false })
        .limit(20);

      if (error) throw error;

      setSnapshots(prev => ({
        ...prev,
        [sourceId]: data || []
      }));
    } catch (error) {
      console.error('Error loading snapshots:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getSourceStatus = (source: Source): { label: string; color: string; icon: any } => {
    const sourceSnapshots = snapshots[source.id] || [];

    if (sourceSnapshots.length === 0) {
      return {
        label: 'Watching',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: Monitor
      };
    }

    const hasRecentChange = sourceSnapshots.length > 1 &&
      sourceSnapshots[0].content_hash !== sourceSnapshots[1].content_hash;

    if (hasRecentChange) {
      return {
        label: 'Changed',
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: AlertCircle
      };
    }

    return {
      label: 'No changes',
      color: 'bg-gray-100 text-gray-700 border-gray-200',
      icon: CheckCircle
    };
  };

  const getLastScannedTime = (source: Source): string => {
    const sourceSnapshots = snapshots[source.id] || [];
    if (sourceSnapshots.length === 0) return 'Not yet scanned';

    const lastScan = new Date(sourceSnapshots[0].snapshot_date);
    const now = new Date();
    const diffMs = now.getTime() - lastScan.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return lastScan.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getLastChangeTime = (source: Source): string => {
    const sourceSnapshots = snapshots[source.id] || [];
    if (sourceSnapshots.length < 2) return 'No changes yet';

    for (let i = 0; i < sourceSnapshots.length - 1; i++) {
      if (sourceSnapshots[i].content_hash !== sourceSnapshots[i + 1].content_hash) {
        const changeDate = new Date(sourceSnapshots[i].snapshot_date);
        return changeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }

    return 'No changes detected';
  };

  const getChangeSummary = (currentSnapshot: SourceSnapshot, previousSnapshot: SourceSnapshot): string => {
    if (currentSnapshot.content_hash === previousSnapshot.content_hash) {
      return 'No changes detected in the page content.';
    }

    const currentText = currentSnapshot.content_text || '';
    const previousText = previousSnapshot.content_text || '';

    if (currentText.length > previousText.length) {
      return `Content expanded - approximately ${currentText.length - previousText.length} characters added to the page.`;
    } else if (currentText.length < previousText.length) {
      return `Content reduced - approximately ${previousText.length - currentText.length} characters removed from the page.`;
    } else {
      return 'Page content modified - wording or structure changed.';
    }
  };

  const getKeyChanges = (currentSnapshot: SourceSnapshot, previousSnapshot: SourceSnapshot): string[] => {
    if (currentSnapshot.content_hash === previousSnapshot.content_hash) {
      return [];
    }

    const changes: string[] = [];
    const currentText = currentSnapshot.content_text || '';
    const previousText = previousSnapshot.content_text || '';

    if (currentText.length > previousText.length) {
      changes.push('New content added to the page');
    }
    if (currentText.length < previousText.length) {
      changes.push('Content removed or shortened');
    }
    if (currentText.includes('update') || currentText.includes('revised')) {
      changes.push('Page indicates updates or revisions');
    }

    if (changes.length === 0) {
      changes.push('Text wording or formatting modified');
    }

    return changes.slice(0, 3);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getTextDiff = (currentSnapshot: SourceSnapshot, previousSnapshot: SourceSnapshot) => {
    if (currentSnapshot.content_hash === previousSnapshot.content_hash) {
      return { added: [], removed: [] };
    }

    const currentLines = (currentSnapshot.content_text || '').split(/[.!?]\s+/).filter(l => l.trim().length > 20);
    const previousLines = (previousSnapshot.content_text || '').split(/[.!?]\s+/).filter(l => l.trim().length > 20);

    const previousSet = new Set(previousLines.map(l => l.trim().toLowerCase()));
    const currentSet = new Set(currentLines.map(l => l.trim().toLowerCase()));

    const added = currentLines.filter(l => !previousSet.has(l.trim().toLowerCase())).slice(0, 10);
    const removed = previousLines.filter(l => !currentSet.has(l.trim().toLowerCase())).slice(0, 10);

    return { added, removed };
  };

  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    setAddModalLoading(true);
    setSuggestedSources([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-tracked-sources`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profileId: profile?.id }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestedSources(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setAddModalLoading(false);
    }
  };

  const handleAddSource = async (source: { name: string; url: string; description: string }) => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('sources')
        .insert({
          profile_id: profile.id,
          name: source.name,
          url: source.url,
          description: source.description,
          is_core_source: true,
          relevance_score: 8,
        })
        .select()
        .single();

      if (error) throw error;

      setSources(prev => [data, ...prev]);
      setSelectedSource(data);

      const { data: { session } } = await supabase.auth.getSession();
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monitor-tracked-sources`;
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profileId: profile.id }),
      });

      setShowAddModal(false);
      setCustomSourceName('');
      setCustomSourceUrl('');
      setCustomSourceDescription('');
    } catch (error) {
      console.error('Error adding source:', error);
      alert('Failed to add source. Please try again.');
    }
  };

  const handleAddCustomSource = () => {
    if (!customSourceName.trim() || !customSourceUrl.trim()) {
      alert('Please provide both a name and URL for the source.');
      return;
    }

    handleAddSource({
      name: customSourceName.trim(),
      url: customSourceUrl.trim(),
      description: customSourceDescription.trim(),
    });
  };

  const frequency = subscription?.frequency || 'weekly';

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

  const selectedSnapshots = selectedSource ? (snapshots[selectedSource.id] || []) : [];
  const displayedSnapshots = showOnlyChanges
    ? selectedSnapshots.filter((snap, idx) => {
        if (idx === selectedSnapshots.length - 1) return false;
        return snap.content_hash !== selectedSnapshots[idx + 1].content_hash;
      })
    : selectedSnapshots;

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
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-900 text-white font-medium"
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

        {/* Main Content - Two Panel Layout */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-5">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Monitored Sources</h1>
            <p className="text-sm text-gray-600">
              We monitor these pages for changes. When wording updates, we summarize what changed.
            </p>
          </div>

          {sources.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <Monitor className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No monitored sources yet</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add sources from your onboarding or settings to start monitoring pages for changes.
                </p>
                <button
                  onClick={() => navigate('/settings')}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                >
                  Go to Settings
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel: Source List */}
              <div className="w-96 border-r border-gray-200 overflow-y-auto">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Tracked Pages</h2>
                  <button
                    onClick={handleOpenAddModal}
                    className="p-1.5 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                    title="Add source"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="divide-y divide-gray-200">
                  {sources.map((source) => {
                    const status = getSourceStatus(source);
                    const StatusIcon = status.icon;
                    const isSelected = selectedSource?.id === source.id;

                    return (
                      <button
                        key={source.id}
                        onClick={() => setSelectedSource(source)}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 truncate">{source.name}</h3>
                            <p className="text-xs text-gray-600 truncate">{source.url}</p>
                          </div>
                          <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 ${isSelected ? 'text-blue-600' : ''}`} />
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Clock className="w-3 h-3" />
                            <span>Last scanned: {getLastScannedTime(source)}</span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Last change: {getLastChangeTime(source)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel: Change Log */}
              <div className="flex-1 overflow-y-auto">
                {selectedSource ? (
                  <div className="p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedSource.name}</h2>
                      <a
                        href={selectedSource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                      >
                        {selectedSource.url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {selectedSource.description && (
                        <p className="text-sm text-gray-600 mt-2">{selectedSource.description}</p>
                      )}
                    </div>

                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Change History</h3>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={showOnlyChanges}
                          onChange={(e) => setShowOnlyChanges(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Show only changes
                      </label>
                    </div>

                    {displayedSnapshots.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 border border-gray-200">
                        <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-600">
                          {showOnlyChanges
                            ? 'No changes detected yet. We\'ll notify you when this page updates.'
                            : 'No scans recorded yet. Check back soon.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {displayedSnapshots.map((snapshot, idx) => {
                          const previousSnapshot = selectedSnapshots[idx + 1];
                          const isChange = previousSnapshot &&
                            snapshot.content_hash !== previousSnapshot.content_hash;

                          return (
                            <div
                              key={snapshot.id}
                              className="border border-gray-200 bg-white p-4"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {formatDateTime(snapshot.snapshot_date)}
                                  </p>
                                </div>
                                {isChange ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium border border-green-200">
                                    <AlertCircle className="w-3 h-3" />
                                    Changed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium border border-gray-200">
                                    <CheckCircle className="w-3 h-3" />
                                    No change
                                  </span>
                                )}
                              </div>

                              {isChange && previousSnapshot && (
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900 mb-1">What changed since the last scan:</p>
                                    <p className="text-sm text-gray-700">
                                      {getChangeSummary(snapshot, previousSnapshot)}
                                    </p>
                                  </div>

                                  {getKeyChanges(snapshot, previousSnapshot).length > 0 && (
                                    <div>
                                      <p className="text-sm font-medium text-gray-900 mb-1">Key changes:</p>
                                      <ul className="list-disc list-inside space-y-0.5">
                                        {getKeyChanges(snapshot, previousSnapshot).map((change, i) => (
                                          <li key={i} className="text-sm text-gray-700">{change}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {(() => {
                                    const diff = getTextDiff(snapshot, previousSnapshot);
                                    if (diff.added.length > 0 || diff.removed.length > 0) {
                                      return (
                                        <button
                                          onClick={() => setSelectedChangeDetail({ snapshot, previousSnapshot })}
                                          className="w-full border border-gray-200 bg-gray-50 p-3 hover:bg-gray-100 transition-colors text-left"
                                        >
                                          <p className="text-sm font-medium text-gray-900 mb-2 flex items-center justify-between">
                                            Show changes
                                            <ChevronRight className="w-4 h-4 text-gray-500" />
                                          </p>

                                          <div className="space-y-1">
                                            {diff.added.length > 0 && (
                                              <p className="text-xs text-green-700">
                                                {diff.added.length} section{diff.added.length !== 1 ? 's' : ''} added
                                              </p>
                                            )}
                                            {diff.removed.length > 0 && (
                                              <p className="text-xs text-red-700">
                                                {diff.removed.length} section{diff.removed.length !== 1 ? 's' : ''} removed
                                              </p>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    }
                                    return null;
                                  })()}

                                  <div>
                                    <a
                                      href={selectedSource.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium"
                                    >
                                      View page
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              )}

                              {!isChange && (
                                <p className="text-sm text-gray-600">
                                  Page content unchanged from previous scan.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full p-8">
                    <p className="text-sm text-gray-600">Select a source to view change history</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Detail Modal */}
      {selectedChangeDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Detailed Changes</h2>
              <button
                onClick={() => setSelectedChangeDetail(null)}
                className="p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Scan date: {formatDateTime(selectedChangeDetail.snapshot.snapshot_date)}
                </p>
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {getChangeSummary(selectedChangeDetail.snapshot, selectedChangeDetail.previousSnapshot)}
                </p>
              </div>

              {(() => {
                const diff = getTextDiff(selectedChangeDetail.snapshot, selectedChangeDetail.previousSnapshot);
                return (
                  <div className="space-y-6">
                    {diff.added.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-green-800 mb-3 uppercase tracking-wide">
                          Added Content ({diff.added.length} section{diff.added.length !== 1 ? 's' : ''})
                        </h3>
                        <div className="space-y-2">
                          {diff.added.map((line, i) => (
                            <div key={i} className="bg-green-50 border-l-4 border-green-400 p-3">
                              <p className="text-sm text-green-900">{line}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {diff.removed.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-red-800 mb-3 uppercase tracking-wide">
                          Removed Content ({diff.removed.length} section{diff.removed.length !== 1 ? 's' : ''})
                        </h3>
                        <div className="space-y-2">
                          {diff.removed.map((line, i) => (
                            <div key={i} className="bg-red-50 border-l-4 border-red-400 p-3">
                              <p className="text-sm text-red-900">{line}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSource && (
                      <div className="pt-4 border-t border-gray-200">
                        <a
                          href={selectedSource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
                        >
                          View current page
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Tracked Source</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* AI Suggestions Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Suggested Sources
                </h3>

                {addModalLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-600">Generating suggestions...</span>
                  </div>
                ) : suggestedSources.length > 0 ? (
                  <div className="space-y-2">
                    {suggestedSources.map((source, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 mb-1">{source.name}</h4>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              {source.url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {source.description && (
                              <p className="text-sm text-gray-600 mt-2">{source.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddSource(source)}
                            className="ml-4 px-3 py-1.5 bg-gray-900 text-white text-sm hover:bg-gray-800 transition-colors whitespace-nowrap"
                          >
                            Add Source
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 border border-gray-200">
                    <p className="text-sm text-gray-600">No suggestions available at this time.</p>
                  </div>
                )}
              </div>

              {/* Manual Entry Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Add Custom Source
                </h3>
                <div className="space-y-4 border border-gray-200 p-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source Name
                    </label>
                    <input
                      type="text"
                      value={customSourceName}
                      onChange={(e) => setCustomSourceName(e.target.value)}
                      placeholder="e.g., Health Canada Regulations"
                      className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL
                    </label>
                    <input
                      type="url"
                      value={customSourceUrl}
                      onChange={(e) => setCustomSourceUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={customSourceDescription}
                      onChange={(e) => setCustomSourceDescription(e.target.value)}
                      placeholder="Brief description of what this source provides"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <button
                    onClick={handleAddCustomSource}
                    className="w-full px-4 py-2 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    Add Custom Source
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

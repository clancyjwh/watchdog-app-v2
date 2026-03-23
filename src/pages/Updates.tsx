import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Update } from '../lib/supabase';
import {
  Activity, LogOut, Settings, CreditCard, BarChart3, Heart, Zap,
  Monitor, ChevronRight, AlertCircle, CheckCircle, Clock, Info, Loader2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getFrequencyLabel } from '../utils/pricing';
import RelevanceModal from '../components/RelevanceModal';
import StarRating from '../components/StarRating';
import CompanySwitcher from '../components/CompanySwitcher';
import Toast from '../components/Toast';

interface BatchGroup {
  batchLabel: string;
  startDate: Date;
  endDate: Date;
  trackedChanges: Update[];
  generalItems: Update[];
  summaryPoints: string[];
}

export default function Updates() {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [batches, setBatches] = useState<BatchGroup[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [monitoredSourcesCount, setMonitoredSourcesCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<string>('');
  const [selectedUpdateForModal, setSelectedUpdateForModal] = useState<Update | null>(null);
  const [isInitialScanInProgress, setIsInitialScanInProgress] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadBatches();
    }
  }, [profile?.id, authLoading]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && profile?.id) {
        loadBatches();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [profile]);

  useEffect(() => {
    if (profile?.id && location.pathname === '/dashboard') {
      loadBatches();
    }
  }, [location.pathname, profile]);

  useEffect(() => {
    if (!isInitialScanInProgress) return;

    const pollInterval = setInterval(() => {
      loadBatches();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [isInitialScanInProgress]);

  const deduplicateUpdates = (updates: Update[]): Update[] => {
    const seen = new Set<string>();
    return updates.filter(update => {
      if (seen.has(update.id)) {
        console.warn(`Duplicate update found and removed: ${update.id} - ${update.title}`);
        return false;
      }
      seen.add(update.id);
      return true;
    });
  };

  const loadBatches = async () => {
    if (!profile?.id) return;

    try {
      const [updatesResponse, subscriptionResponse, snapshotsResponse, sourcesResponse] = await Promise.all([
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
          .from('source_snapshots')
          .select('id, created_at')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('sources')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('is_core_source', true)
      ]);

      const updates = deduplicateUpdates(updatesResponse.data || []);
      const frequency = subscriptionResponse.data?.frequency || 'weekly';
      const subscriptionData = subscriptionResponse.data;
      setSubscription(subscriptionData);

      if (snapshotsResponse.data && snapshotsResponse.data.length > 0) {
        setLastScanTime(snapshotsResponse.data[0].created_at);
      }

      // Check if initial scan is in progress
      const today = new Date().toISOString().split('T')[0];
      const isFirstScanToday = subscriptionData?.first_update_date === today;
      const hasNoUpdates = updates.length === 0;

      // Check if profile was created recently (within the last 2 hours)
      if (profile.created_at) {
        const profileCreatedAt = new Date(profile.created_at);
        const now = new Date();
        const hoursSinceCreation = (now.getTime() - profileCreatedAt.getTime()) / (1000 * 60 * 60);

        if (isFirstScanToday && hasNoUpdates && hoursSinceCreation < 2) {
          setIsInitialScanInProgress(true);
        } else {
          setIsInitialScanInProgress(false);
        }
      }

      const groupedBatches = groupUpdatesByInterval(updates, frequency);
      setBatches(groupedBatches);

      // Set the count of monitored sources
      setMonitoredSourcesCount(sourcesResponse.data?.length || 0);
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const generateBatchSummary = (trackedChanges: Update[], generalItems: Update[]): string[] => {
    const summaryPoints: string[] = [];

    // Get top 3-4 highest relevance updates from both categories
    const allUpdates = [...trackedChanges, ...generalItems]
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 4);

    allUpdates.forEach(update => {
      summaryPoints.push(update.title);
    });

    if (summaryPoints.length === 0) {
      return ['No new updates in this period'];
    }

    return summaryPoints;
  };

  const groupUpdatesByInterval = (updates: Update[], frequency: string): BatchGroup[] => {
    if (updates.length === 0) return [];

    const intervalDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;
    const now = new Date();
    const groups: BatchGroup[] = [];

    const uniqueBatches = Array.from(new Set(updates.map(u => u.delivery_batch).filter(Boolean)));

    for (const batch of uniqueBatches) {
      const batchUpdates = updates.filter(u => u.delivery_batch === batch);
      if (batchUpdates.length === 0) continue;

      const latestDate = new Date(Math.max(...batchUpdates.map(u => new Date(u.created_at).getTime())));
      const earliestDate = new Date(latestDate.getTime() - intervalDays * 24 * 60 * 60 * 1000);

      const trackedChanges = batchUpdates.filter(u => u.source_id !== null);
      const generalItems = batchUpdates.filter(u => u.source_id === null);

      const summaryPoints = generateBatchSummary(trackedChanges, generalItems);

      groups.push({
        batchLabel: batch,
        startDate: earliestDate,
        endDate: latestDate,
        trackedChanges,
        generalItems,
        summaryPoints,
      });
    }

    groups.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());

    return groups;
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleFavorite = async (updateId: string, currentSavedStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const { error } = await supabase
        .from('updates')
        .update({ is_saved: !currentSavedStatus })
        .eq('id', updateId);

      if (error) throw error;

      setBatches(batches.map(batch => ({
        ...batch,
        trackedChanges: batch.trackedChanges.map(u =>
          u.id === updateId ? { ...u, is_saved: !currentSavedStatus } : u
        ),
        generalItems: batch.generalItems.map(u =>
          u.id === updateId ? { ...u, is_saved: !currentSavedStatus } : u
        ),
      })));

      if (!currentSavedStatus) {
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const formatBatchDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusInfo = () => {
    const latestBatch = batches[0];
    if (latestBatch && (latestBatch.trackedChanges.length > 0 || latestBatch.generalItems.length > 0)) {
      return { label: 'New changes detected', color: 'text-green-700', icon: AlertCircle };
    }
    return { label: 'Up to date', color: 'text-gray-600', icon: CheckCircle };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

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

  if (!profile || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-600 mb-6">
            We couldn't load your profile. Please sign in again.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Back to Login
          </button>
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
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm bg-gray-900 text-white font-medium"
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
          <div className="bg-white border-b border-gray-200 px-6 py-5">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Updates</h1>
              <p className="text-sm text-gray-600">Debriefs delivered on your schedule</p>
            </div>

            {/* Notification Center */}
            <div className="bg-gray-50 border border-gray-200 p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Frequency</p>
                  <p className="text-sm font-semibold text-gray-900 capitalize">
                    {profile?.subscription_frequency || 'Weekly'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Monitored Sources</p>
                  <p className="text-sm font-semibold text-gray-900">{monitoredSourcesCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Areas of Interest</p>
                  <p className="text-sm font-semibold text-gray-900">{profile?.business_goals || 'Not set'}</p>
                </div>
              </div>
              {lastScanTime && (
                <p className="text-xs text-gray-500 mt-3">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Last scan run: {formatTimeAgo(lastScanTime)}
                </p>
              )}
            </div>
          </div>

          {/* Batch Cards List */}
          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Scheduled Batches */}
              {batches.length === 0 ? (
                <div className="bg-white border border-gray-200 p-12 text-center">
                  {isInitialScanInProgress ? (
                    <>
                      <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                      <h3 className="text-base font-semibold text-gray-900 mb-2">Your first scan is in progress</h3>
                      <p className="text-sm text-gray-600 mb-6">
                        We're analyzing your monitored sources and generating background research. This typically takes 2-5 minutes.
                      </p>
                      <div className="max-w-md mx-auto">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          This page will automatically refresh when new updates are available.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <h3 className="text-base font-semibold text-gray-900 mb-2">No debriefs yet</h3>
                      <p className="text-sm text-gray-600">
                        Your first debrief will appear here based on your configured schedule.
                      </p>
                    </>
                  )}
                </div>
              ) : batches.length > 0 ? (
                <div className="space-y-4">
                  {batches.map((batch, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(`/updates/${encodeURIComponent(batch.batchLabel)}`)}
                      className="w-full bg-white border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all text-left"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {formatBatchDate(batch.endDate)}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            Covers {formatBatchDate(batch.startDate)} → {formatBatchDate(batch.endDate)}
                          </p>
                          <ul className="space-y-1">
                            {batch.summaryPoints.map((point, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">•</span>
                                <span className="flex-1 break-words">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                      </div>

                      <div className="flex items-center gap-6 mb-3">
                        <div>
                          <p className="text-xs text-gray-600 mb-0.5">Monitored sources</p>
                          <p className="text-lg font-semibold text-gray-900">{batch.trackedChanges.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-0.5">Research findings</p>
                          <p className="text-lg font-semibold text-gray-900">{batch.generalItems.length}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100">
                        <span className="text-sm font-medium text-blue-600">View debrief →</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Relevance Modal */}
      {selectedUpdateForModal && (
        <RelevanceModal
          isOpen={!!selectedUpdateForModal}
          onClose={() => setSelectedUpdateForModal(null)}
          title={selectedUpdateForModal.title}
          relevanceScore={selectedUpdateForModal.relevance_score}
          reasoning={selectedUpdateForModal.relevance_reasoning}
        />
      )}

      {showToast && (
        <Toast
          message="Saved to archive"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

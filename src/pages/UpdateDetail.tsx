import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Update } from '../lib/supabase';
import {
  Activity, LogOut, Settings, CreditCard, BarChart3, Heart, Zap,
  Monitor, ExternalLink, ArrowLeft, AlertCircle, Trash2, ChevronDown, ChevronRight
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getFrequencyLabel } from '../utils/pricing';
import RelevanceModal from '../components/RelevanceModal';
import Toast from '../components/Toast';

export default function UpdateDetail() {
  const { batchLabel } = useParams<{ batchLabel: string }>();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [trackedChanges, setTrackedChanges] = useState<Update[]>([]);
  const [generalItems, setGeneralItems] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [previousBatchDate, setPreviousBatchDate] = useState<string>('');
  const [relevanceModalOpen, setRelevanceModalOpen] = useState(false);
  const [selectedUpdateForRelevance, setSelectedUpdateForRelevance] = useState<Update | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (profile?.id && batchLabel) {
      loadBatchDetails();
    }
  }, [profile, batchLabel]);

  const loadBatchDetails = async () => {
    if (!profile?.id || !batchLabel) return;

    const decodedBatchLabel = decodeURIComponent(batchLabel);

    try {
      const { data: updates } = await supabase
        .from('updates')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('delivery_batch', decodedBatchLabel)
        .order('published_at', { ascending: false });

      // Get the results_per_scan limit from profile
      const resultsLimit = profile.results_per_scan || 10;

      // Sort all updates by relevance score and take top N
      const sortedUpdates = (updates || []).sort((a, b) => b.relevance_score - a.relevance_score);
      const limitedUpdates = sortedUpdates.slice(0, resultsLimit);

      // Split into tracked and general after limiting
      const tracked = limitedUpdates.filter(u => u.source_id !== null);
      const general = limitedUpdates.filter(u => u.source_id === null);

      setTrackedChanges(tracked);
      setGeneralItems(general);

      const allBatches = await supabase
        .from('updates')
        .select('delivery_batch, created_at')
        .eq('profile_id', profile.id)
        .not('delivery_batch', 'like', 'Manual Scan%')
        .order('created_at', { ascending: false });

      const uniqueBatches = Array.from(
        new Set(allBatches.data?.map(u => u.delivery_batch))
      );
      const currentIndex = uniqueBatches.indexOf(decodedBatchLabel);
      if (currentIndex > -1 && currentIndex < uniqueBatches.length - 1) {
        const previousBatch = uniqueBatches[currentIndex + 1];
        const previousUpdate = allBatches.data?.find(u => u.delivery_batch === previousBatch);
        if (previousUpdate) {
          setPreviousBatchDate(new Date(previousUpdate.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          }));
        }
      }
    } catch (error) {
      console.error('Error loading batch details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const deleteUpdate = async (updateId: string) => {
    try {
      await supabase
        .from('updates')
        .delete()
        .eq('id', updateId);

      setTrackedChanges(prev => prev.filter(u => u.id !== updateId));
      setGeneralItems(prev => prev.filter(u => u.id !== updateId));
    } catch (error) {
      console.error('Error deleting update:', error);
    }
  };

  const toggleSaveUpdate = async (updateId: string, currentlySaved: boolean) => {
    try {
      await supabase
        .from('updates')
        .update({ is_saved: !currentlySaved })
        .eq('id', updateId);

      const updateItem = (items: Update[]) =>
        items.map(u => (u.id === updateId ? { ...u, is_saved: !currentlySaved } : u));

      setTrackedChanges(prev => updateItem(prev));
      setGeneralItems(prev => updateItem(prev));

      if (!currentlySaved) {
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const getRelevanceColor = (score: number) => {
    // Gradient from red (0) to yellow (5) to green (10)
    if (score >= 8) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 6) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (score >= 4) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    if (score >= 2) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mb-4"></div>
          <p className="text-sm text-gray-600">Loading debrief...</p>
        </div>
      </div>
    );
  }

  const currentDate = trackedChanges[0]?.created_at || generalItems[0]?.created_at;
  const formattedCurrentDate = currentDate
    ? new Date(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

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
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Updates
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Update: {formattedCurrentDate}
            </h1>
            {previousBatchDate && (
              <p className="text-sm text-gray-600">Changes since {previousBatchDate}</p>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Section A: Monitored Source Changes */}
              <div>
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Monitored Sources</h2>
                  <p className="text-sm text-gray-600">Changes from your tracked websites ({trackedChanges.length})</p>
                </div>
                {trackedChanges.length === 0 ? (
                  <div className="bg-white border border-gray-200 p-8 text-center">
                    <p className="text-sm text-gray-600">No monitored source changes</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trackedChanges.sort((a, b) => b.relevance_score - a.relevance_score).map((update) => {
                      const isExpanded = expandedItem === update.id;
                      const relevanceColor = getRelevanceColor(update.relevance_score);

                      return (
                        <div key={update.id} className="bg-blue-50 border border-blue-200">
                          <div className="p-4">
                            <button
                              onClick={() => setExpandedItem(isExpanded ? null : update.id)}
                              className="w-full text-left hover:bg-gray-50 transition-colors -m-4 p-4"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedUpdateForRelevance(update);
                                        setRelevanceModalOpen(true);
                                      }}
                                      className={`px-2 py-0.5 text-xs font-bold border ${relevanceColor} hover:opacity-80 transition-opacity cursor-pointer`}
                                    >
                                      {update.relevance_score}/10
                                    </button>
                                    <span className="text-xs text-gray-500">{update.source_name}</span>
                                  </div>
                                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{update.title}</h3>
                                  <p className="text-xs text-gray-600 truncate">{update.original_url}</p>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                )}
                              </div>
                            </button>
                            {!isExpanded && (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSaveUpdate(update.id, update.is_saved);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {update.is_saved ? 'Remove from archive' : 'Save'}
                                </button>
                              </div>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-gray-100">
                              <div className="mt-4 mb-4">
                                <p className="text-sm font-medium text-gray-900 mb-2">What changed:</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{update.summary}</p>
                              </div>

                              <div className="flex items-center gap-3">
                                <a
                                  href={update.original_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
                                >
                                  View page
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSaveUpdate(update.id, update.is_saved);
                                  }}
                                  className={`p-2 transition-colors ${
                                    update.is_saved
                                      ? 'text-red-600 hover:bg-red-50'
                                      : 'text-gray-400 hover:bg-gray-100'
                                  }`}
                                  title={update.is_saved ? 'Remove from Archive' : 'Save to Archive'}
                                >
                                  <Heart className={`w-5 h-5 ${update.is_saved ? 'fill-current' : ''}`} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteUpdate(update.id);
                                  }}
                                  className="p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                                  title="Remove"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section B: Research Findings */}
              <div>
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Research Findings</h2>
                  <p className="text-sm text-gray-600">AI-discovered insights ({generalItems.length})</p>
                </div>

                {generalItems.length === 0 ? (
                  <div className="bg-white border border-gray-200 p-8 text-center">
                    <p className="text-sm text-gray-600">No research findings</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                      {generalItems.sort((a, b) => b.relevance_score - a.relevance_score).map((update) => {
                        const isExpanded = expandedItem === update.id;
                        const relevanceColor = getRelevanceColor(update.relevance_score);

                        return (
                          <div key={update.id} className="bg-green-50 border border-green-200">
                            <div className="p-4">
                              <button
                                onClick={() => setExpandedItem(isExpanded ? null : update.id)}
                                className="w-full text-left hover:bg-gray-50 transition-colors -m-4 p-4"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedUpdateForRelevance(update);
                                          setRelevanceModalOpen(true);
                                        }}
                                        className={`px-2 py-0.5 text-xs font-bold border ${relevanceColor} hover:opacity-80 transition-opacity cursor-pointer`}
                                      >
                                        {update.relevance_score}/10
                                      </button>
                                      <span className="text-xs text-gray-500">{update.source_name}</span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900">{update.title}</h3>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                  )}
                                </div>
                              </button>
                              {!isExpanded && (
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSaveUpdate(update.id, update.is_saved);
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  >
                                    {update.is_saved ? 'Remove from archive' : 'Save'}
                                  </button>
                                </div>
                              )}
                            </div>

                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-gray-100">
                                <p className="text-sm text-gray-700 leading-relaxed my-4">{update.summary}</p>

                                <div className="flex items-center gap-3">
                                  <a
                                    href={update.original_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
                                  >
                                    Read Article
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSaveUpdate(update.id, update.is_saved);
                                    }}
                                    className={`p-2 transition-colors ${
                                      update.is_saved
                                        ? 'text-red-600 hover:bg-red-50'
                                        : 'text-gray-400 hover:bg-gray-100'
                                    }`}
                                    title={update.is_saved ? 'Remove from Archive' : 'Save to Archive'}
                                  >
                                    <Heart className={`w-5 h-5 ${update.is_saved ? 'fill-current' : ''}`} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteUpdate(update.id);
                                    }}
                                    className="p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 transition-colors"
                                    title="Remove"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>

            {/* Empty State */}
            {trackedChanges.length === 0 && generalItems.length === 0 && (
              <div className="col-span-2 bg-white border border-gray-200 p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-2">No updates in this debrief</h3>
                <p className="text-sm text-gray-600">
                  There were no changes detected during this period.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <RelevanceModal
        isOpen={relevanceModalOpen}
        onClose={() => {
          setRelevanceModalOpen(false);
          setSelectedUpdateForRelevance(null);
        }}
        title={selectedUpdateForRelevance?.title || ''}
        relevanceScore={selectedUpdateForRelevance?.relevance_score || 0}
        reasoning={selectedUpdateForRelevance?.relevance_reasoning || null}
      />

      {showToast && (
        <Toast
          message="Saved to archive"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}

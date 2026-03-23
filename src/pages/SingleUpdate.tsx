import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Update } from '../lib/supabase';
import {
  Activity, LogOut, Settings, CreditCard, BarChart3, Heart, Zap,
  Monitor, ExternalLink, ArrowLeft
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getFrequencyLabel } from '../utils/pricing';
import RelevanceModal from '../components/RelevanceModal';
import StarRating from '../components/StarRating';
import ContentTag from '../components/ContentTag';

export default function SingleUpdate() {
  const { updateId } = useParams<{ updateId: string }>();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [update, setUpdate] = useState<Update | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRelevanceModal, setShowRelevanceModal] = useState(false);

  useEffect(() => {
    if (profile?.id && updateId) {
      loadUpdate();
    }
  }, [profile, updateId]);

  const loadUpdate = async () => {
    if (!profile?.id || !updateId) return;

    try {
      const { data } = await supabase
        .from('updates')
        .select('*')
        .eq('id', updateId)
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (data) {
        setUpdate(data);

        if (!data.is_read) {
          await supabase
            .from('updates')
            .update({ is_read: true })
            .eq('id', updateId);
        }
      }
    } catch (error) {
      console.error('Error loading update:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleSaved = async () => {
    if (!update) return;

    const newSavedStatus = !update.is_saved;
    await supabase
      .from('updates')
      .update({ is_saved: newSavedStatus })
      .eq('id', update.id);

    setUpdate({ ...update, is_saved: newSavedStatus });
  };

  const deleteUpdate = async () => {
    if (!update || !confirm('Are you sure you want to delete this update?')) return;

    await supabase
      .from('updates')
      .delete()
      .eq('id', update.id);

    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!update) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Update not found</h2>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-700"
          >
            Return to Updates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-gray-900 text-white flex flex-col">
          <div className="p-6">
            <h1 className="text-2xl font-bold">WatchDog AI</h1>
          </div>

          <nav className="flex-1 px-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-800 transition-colors mb-1"
            >
              <Activity className="w-4 h-4" />
              Updates
            </button>
            <button
              onClick={() => navigate('/scans')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-800 transition-colors mb-1"
            >
              <Zap className="w-4 h-4" />
              Research
            </button>
            <button
              onClick={() => navigate('/tracked-sources')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-800 transition-colors mb-1"
            >
              <Monitor className="w-4 h-4" />
              Monitored Sources
            </button>
            <button
              onClick={() => navigate('/archive')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-800 transition-colors mb-1"
            >
              <Heart className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-800 transition-colors mb-1"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            <button
              onClick={() => navigate('/billing')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              Billing
            </button>
          </nav>

          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm">
                <div className="font-medium">{user?.email}</div>
                <div className="text-gray-400 text-xs capitalize">
                  {getFrequencyLabel(profile?.subscription_frequency || 'weekly')}
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Updates
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSaved}
                  className={`p-2 hover:bg-gray-100 transition-colors ${
                    update.is_saved ? 'text-red-600' : 'text-gray-600'
                  }`}
                  title={update.is_saved ? 'Remove from saved' : 'Save for later'}
                >
                  <Heart className={`w-5 h-5 ${update.is_saved ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            <div className="max-w-3xl mx-auto">
              <div className="bg-white border border-gray-200 p-8">
                {/* Header Info */}
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h1 className="text-2xl font-bold text-gray-900 flex-1">{update.title}</h1>
                        {update.content_type && (
                          <ContentTag contentType={update.content_type} size="md" />
                        )}
                      </div>
                      {update.source_name && (
                        <p className="text-sm text-gray-600 mb-1">
                          Source: <span className="font-medium">{update.source_name}</span>
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        {new Date(update.published_at).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="ml-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{update.relevance_score}/10</div>
                        <button
                          onClick={() => setShowRelevanceModal(true)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Why?
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {update.content_type && (
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 uppercase tracking-wide">
                        {update.content_type}
                      </span>
                    )}
                    <StarRating
                      sourceUrl={update.source_url}
                      sourceName={update.source_name}
                      updateId={update.id}
                      size="md"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">Summary</h2>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{update.summary}</p>
                </div>

                {/* Key Points */}
                {update.key_points && update.key_points.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Key Points</h2>
                    <ul className="space-y-2">
                      {update.key_points.map((point, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span className="text-gray-700">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Business Implications */}
                {update.business_implications && (
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Business Implications</h2>
                    <p className="text-gray-700 leading-relaxed">{update.business_implications}</p>
                  </div>
                )}

                {/* Action Items */}
                {update.action_items && update.action_items.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Recommended Actions</h2>
                    <ul className="space-y-2">
                      {update.action_items.map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span className="text-green-600 mt-1">→</span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Original Link */}
                {update.original_url && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <a
                      href={update.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View Original Article
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRelevanceModal && (
        <RelevanceModal
          isOpen={showRelevanceModal}
          onClose={() => setShowRelevanceModal(false)}
          title={update.title}
          relevanceScore={update.relevance_score}
          reasoning={update.relevance_reasoning}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Monitor, Plus, X, Loader2, ExternalLink, AlertCircle, CheckCircle, Clock, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

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
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [sources, setSources] = useState<Source[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, SourceSnapshot[]>>({});
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
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
      const { data: sourcesData } = await supabase
        .from('sources')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('is_core_source', true)
        .order('created_at', { ascending: false });

      setSources(sourcesData || []);

      if (sourcesData && sourcesData.length > 0 && !selectedSource) {
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

  const getSourceStatus = (source: Source): { label: string; color: string; icon: any } => {
    const sourceSnapshots = snapshots[source.id] || [];

    if (sourceSnapshots.length === 0) {
      return {
        label: 'Watching',
        color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        icon: Monitor
      };
    }

    const hasRecentChange = sourceSnapshots.length > 1 &&
      sourceSnapshots[0].content_hash !== sourceSnapshots[1].content_hash;

    if (hasRecentChange) {
      return {
        label: 'Changed',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: AlertCircle
      };
    }

    return {
      label: 'Stable',
      color: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      icon: CheckCircle
    };
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

  const getLastScannedTime = (source: Source): string => {
    const sourceSnapshots = snapshots[source.id] || [];
    if (sourceSnapshots.length === 0) return 'Not Scanned';
    return formatDateTime(sourceSnapshots[0].snapshot_date);
  };

  const getChangeSummary = (current: SourceSnapshot, previous: SourceSnapshot): string => {
    if (current.content_hash === previous.content_hash) return 'No content change.';
    const cLen = current.content_text?.length || 0;
    const pLen = previous.content_text?.length || 0;
    if (cLen > pLen) return `Added ${cLen - pLen} characters.`;
    if (cLen < pLen) return `Removed ${pLen - cLen} characters.`;
    return 'Content structure modified.';
  };

  const getTextDiff = (current: SourceSnapshot, previous: SourceSnapshot) => {
    const currentLines = (current.content_text || '').split(/[.!?]\s+/).filter(l => l.trim().length > 20);
    const previousLines = (previous.content_text || '').split(/[.!?]\s+/).filter(l => l.trim().length > 20);
    const previousSet = new Set(previousLines.map(l => l.trim().toLowerCase()));
    const added = currentLines.filter(l => !previousSet.has(l.trim().toLowerCase())).slice(0, 5);
    return { added };
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
      console.error('Error:', error);
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
      setShowAddModal(false);
    } catch (error) {
      alert('Error adding source.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  const selectedSnapshots = selectedSource ? (snapshots[selectedSource.id] || []) : [];
  const displayedSnapshots = showOnlyChanges
    ? selectedSnapshots.filter((snap, idx) => {
        if (idx === selectedSnapshots.length - 1) return false;
        return snap.content_hash !== selectedSnapshots[idx + 1].content_hash;
      })
    : selectedSnapshots;

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-6 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800/50 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Monitor className="w-6 h-6 text-blue-500" />
              Tracked Sources
            </h1>
            <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">Monitor changes on specific web pages</p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus className="w-4 h-4" /> Add Source
          </button>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Source List */}
          <div className="w-80 border-r border-slate-800/50 overflow-y-auto bg-slate-900/20">
            <div className="p-4 uppercase tracking-widest text-[10px] font-black text-slate-500 border-b border-slate-800/50">
              Web Pages
            </div>
            <div className="divide-y divide-slate-800/30">
              {sources.map((source) => {
                const status = getSourceStatus(source);
                const StatusIcon = status.icon;
                const isSelected = selectedSource?.id === source.id;

                return (
                  <button
                    key={source.id}
                    onClick={() => setSelectedSource(source)}
                    className={`w-full p-4 text-left transition-all hover:bg-slate-800/30 ${
                      isSelected ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="font-bold text-sm mb-1 truncate">{source.name}</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase border rounded ${status.color}`}>
                        <StatusIcon className="w-3 h-3" /> {status.label}
                      </span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Scanned: {getLastScannedTime(source)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Change Log */}
          <div className="flex-1 overflow-y-auto">
            {selectedSource ? (
              <div className="p-8 max-w-4xl mx-auto">
                <div className="flex items-start justify-between mb-8 group">
                  <div>
                    <h2 className="text-3xl font-black text-white mb-2">{selectedSource.name}</h2>
                    <a
                      href={selectedSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline flex items-center gap-1 font-bold"
                    >
                      {selectedSource.url} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyChanges}
                      onChange={(e) => setShowOnlyChanges(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500"
                    />
                    Only Changes
                  </label>
                </div>

                <div className="space-y-6">
                  {displayedSnapshots.map((snap, idx) => {
                    const prev = selectedSnapshots[idx + 1];
                    const isChange = prev && snap.content_hash !== prev.content_hash;

                    return (
                      <div key={snap.id} className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800/30">
                          <span className="text-xs font-black uppercase text-slate-500">{formatDateTime(snap.snapshot_date)}</span>
                          {isChange ? (
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/20 rounded-lg">
                              Page Updated
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-slate-800 text-slate-500 text-[10px] font-black uppercase rounded-lg">
                              No Change
                            </span>
                          )}
                        </div>

                        {isChange && prev && (
                          <div className="space-y-4">
                            <p className="text-sm text-slate-300 font-bold leading-relaxed">
                              {getChangeSummary(snap, prev)}
                            </p>
                            {getTextDiff(snap, prev).added.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-slate-500">Key Additions:</p>
                                {getTextDiff(snap, prev).added.map((line, i) => (
                                  <div key={i} className="bg-emerald-500/5 border-l-2 border-emerald-500/50 p-3 italic text-sm text-emerald-200/80">
                                    "{line}..."
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {!isChange && <p className="text-xs text-slate-500">Content stable. No wording modifications detected.</p>}
                      </div>
                    );
                  })}
                  {displayedSnapshots.length === 0 && (
                    <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl">
                      <Monitor className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500 font-bold">No change history recorded yet.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 font-bold uppercase tracking-widest text-xs">
                Select a tracked source to view history
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black">Add Monitored Page</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white"><X /></button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Page Name (e.g. Price Sheet)"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none"
                value={customSourceName} onChange={e => setCustomSourceName(e.target.value)}
              />
              <input
                placeholder="URL (https://...)"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none"
                value={customSourceUrl} onChange={e => setCustomSourceUrl(e.target.value)}
              />
              <button
                onClick={() => handleAddSource({name: customSourceName, url: customSourceUrl, description: ''})}
                className="w-full bg-blue-600 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
              >
                Track URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Archive as VaultIcon, 
  Search, Info, ExternalLink, Activity, 
  Layers, Clock, Heart, Filter, Globe, Sparkles,
  ChevronDown, ChevronUp, Zap, FileText, CheckCircle2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RelevanceModal from '../components/RelevanceModal';
import CompanySwitcher from '../components/CompanySwitcher';
import ResultCard from '../components/ResultCard';

interface VaultItem {
  id: string;
  title: string;
  summary: string;
  url: string | null;
  source: string;
  date: string;
  relevanceScore: number;
  relevanceReasoning: string;
  contentType: string;
  isFavourite: boolean;
  isRead: boolean;
  itemType: 'automated' | 'manual';
  raw_data?: any;
}

export default function Vault() {
  const { profile, currentCompany, authLoading } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedManualId, setExpandedManualId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadVault();
    }
  }, [profile?.id, currentCompany?.id, authLoading]);

  const loadVault = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Automated Updates
      let updatesQuery = supabase
        .from('updates')
        .select('*')
        .order('published_at', { ascending: false });
      
      if (currentCompany?.id) {
        updatesQuery = updatesQuery.eq('company_id', currentCompany.id);
      } else {
        updatesQuery = updatesQuery.eq('profile_id', profile.id);
      }

      // 2. Fetch Manual Scan Summaries
      let scansQuery = supabase
        .from('scan_summaries')
        .select('*')
        .order('scan_date', { ascending: false });

      if (currentCompany?.id) {
        scansQuery = scansQuery.eq('company_id', currentCompany.id);
      } else {
        scansQuery = scansQuery.eq('profile_id', profile.id);
      }

      const [updatesRes, scansRes] = await Promise.all([updatesQuery, scansQuery]);

      if (updatesRes.error) throw updatesRes.error;
      if (scansRes.error) throw scansRes.error;

      const automatedItems: VaultItem[] = (updatesRes.data || []).map(u => ({
        id: u.id,
        title: u.title,
        summary: u.summary,
        url: u.url,
        source: u.source_name || 'Automated Feed',
        date: u.published_at || u.created_at,
        relevanceScore: u.relevance_score || 0,
        relevanceReasoning: u.relevance_reasoning || '',
        contentType: u.content_type || 'intelligence',
        isFavourite: u.is_favourite || false,
        isRead: u.is_read || false,
        itemType: 'automated',
        raw_data: u
      }));

      const manualItems: VaultItem[] = (scansRes.data || []).flatMap(s => 
        (s.citations || []).map((cit: any, idx: number) => ({
          id: `${s.id}-cit-${idx}`,
          title: cit.headline || cit.title || 'Untitled',
          summary: cit.summary || '',
          url: cit.url,
          source: cit.source_name || cit.source || 'Deep Research',
          date: s.scan_date,
          relevanceScore: cit.relevance_score_0_100 || cit.relevance_score || 100,
          relevanceReasoning: cit.justification || '',
          contentType: cit.content_type || 'strategic-report',
          primaryLabel: cit.primary_label || 'Insight',
          keyInsights: cit.key_insights || [],
          nextSteps: cit.next_steps || [],
          isFavourite: cit.is_favourite || false,
          isRead: true,
          itemType: 'manual',
          raw_data: { ...cit, parentScanId: s.id, parentScanIndex: idx }
        }))
      );

      const combined = [...automatedItems, ...manualItems].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setItems(combined);
    } catch (err) {
      console.error('Failed to load vault:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavourite = async (item: VaultItem) => {
    try {
      if (item.itemType === 'automated') {
        const { error } = await supabase
          .from('updates')
          .update({ is_favourite: !item.isFavourite })
          .eq('id', item.raw_data.id);
        if (error) throw error;
      } else {
        const parentId = item.raw_data.parentScanId;
        const index = item.raw_data.parentScanIndex;
        const { data: scan } = await supabase.from('scan_summaries').select('citations').eq('id', parentId).single();
        if (scan?.citations && Array.isArray(scan.citations)) {
           scan.citations[index].is_favourite = !item.isFavourite;
           const { error } = await supabase.from('scan_summaries').update({ citations: scan.citations }).eq('id', parentId);
           if (error) throw error;
        }
      }
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isFavourite: !item.isFavourite } : i));
    } catch (err) {
      console.error('Error toggling favourite:', err);
    }
  };

  const handleBulkMarkRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      const idsArray = Array.from(selectedIds);
      // Only updates have is_read
      const updateIds = items
        .filter(i => i.itemType === 'automated' && selectedIds.has(i.id))
        .map(i => i.id);

      if (updateIds.length > 0) {
        await supabase
          .from('updates')
          .update({ is_read: true })
          .in('id', updateIds);
      }

      setItems(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, isRead: true } : i));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk read error:', err);
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredItems = useMemo(() => {
    return items.filter(a => 
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      a.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  if (authLoading) return null;

  return (
    <div className="flex bg-[#020617] min-h-screen text-slate-200 font-sans overflow-hidden">
      <Sidebar activePage="vault" />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <header className="px-8 h-24 bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50 z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 shadow-xl">
              <VaultIcon className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 leading-none">
                The Vault
              </h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
                Unified Intelligence Repository
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <CompanySwitcher />
            {selectedIds.size > 0 && (
              <button 
                onClick={handleBulkMarkRead}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all scale-in"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark {selectedIds.size} Read
              </button>
            )}
          </div>
        </header>

        <div className="h-16 border-b border-slate-800/30 flex items-center px-8 bg-slate-900/30 backdrop-blur-sm z-10">
          <div className="flex-1 relative flex items-center">
            <Search className="absolute left-0 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Querying vaulted intelligence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-300 pl-7 placeholder:text-slate-600 outline-none"
            />
          </div>
          <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span>Total Items: {items.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto pb-32">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                 <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                 <p className="text-slate-500 font-black uppercase tracking-widest animate-pulse">Synchronizing Records...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="glass-card border-dashed border-2 border-slate-800/50 bg-slate-900/20 rounded-[40px] p-32 text-center">
                 <div className="w-24 h-24 bg-slate-950 border border-slate-800 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                    <Globe className="w-12 h-12 text-slate-800" />
                 </div>
                 <h2 className="text-2xl font-bold text-white mb-3">Vault is Empty</h2>
                 <p className="text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed font-medium">
                    No records found. High-signal findings from automated feeds and manual scans will be archived here.
                 </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <ResultCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    summary={item.summary}
                    url={item.url}
                    source={item.source}
                    date={item.date}
                    relevanceScore={item.relevanceScore}
                    relevanceReasoning={item.relevanceReasoning}
                    contentType={item.contentType}
                    primaryLabel={item.raw_data?.primary_label || item.raw_data?.primaryLabel}
                    keyInsights={item.raw_data?.key_insights || item.raw_data?.keyInsights}
                    nextSteps={item.raw_data?.next_steps || item.raw_data?.nextSteps}
                    isFavourite={item.isFavourite}
                    onToggleFavourite={(e) => toggleFavourite(item)}
                    selectable={true}
                    selected={selectedIds.has(item.id)}
                    onToggleSelect={(e) => toggleSelect(item.id, e as any)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedItem && (
        <RelevanceModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem.title}
          relevanceScore={selectedItem.relevanceScore}
          reasoning={selectedItem.relevanceReasoning}
        />
      )}
    </div>
  );
}

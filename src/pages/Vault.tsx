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
        itemType: 'automated'
      }));

      const manualItems: VaultItem[] = (scansRes.data || []).map(s => ({
        id: s.id,
        title: `Deep Research Report: ${new Date(s.scan_date).toLocaleDateString()}`,
        summary: s.overview,
        url: null,
        source: 'Deep Research',
        date: s.scan_date,
        relevanceScore: 100,
        relevanceReasoning: 'On-demand strategic intelligence generated specifically for your parameters.',
        contentType: s.content_type || 'strategic-report',
        isFavourite: s.is_favourite || false,
        isRead: true, // Manual scans are usually considered "read" once generated
        itemType: 'manual',
        raw_data: s
      }));

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
      const table = item.itemType === 'automated' ? 'updates' : 'scan_summaries';
      const { error } = await supabase
        .from(table)
        .update({ is_favourite: !item.isFavourite })
        .eq('id', item.id);
      
      if (error) throw error;
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
                  <div 
                    key={item.id}
                    onClick={() => item.itemType === 'manual' && setExpandedManualId(expandedManualId === item.id ? null : item.id)}
                    className={`glass-card group relative p-6 border transition-all duration-300 ${
                      item.itemType === 'manual' ? 'bg-blue-900/10 border-blue-500/20' : 'bg-slate-900/30 border-slate-800/50 hover:border-slate-700'
                    } ${selectedIds.has(item.id) ? 'border-blue-500 ring-1 ring-blue-500/50' : ''}`}
                  >
                    <div className="flex gap-6 items-start">
                      <button 
                        onClick={(e) => toggleSelect(item.id, e)}
                        className={`mt-1.5 w-5 h-5 rounded border transition-all flex items-center justify-center ${
                          selectedIds.has(item.id) ? 'bg-blue-600 border-blue-600 shadow-lg' : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {selectedIds.has(item.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-[0.2em] border ${
                              item.itemType === 'manual' ? 'bg-blue-500 text-white border-blue-400' : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {item.source}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                              {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleFavourite(item); }}
                              className={`p-2 rounded-lg transition-all ${item.isFavourite ? 'bg-red-500/10 text-red-500' : 'text-slate-600 hover:text-red-400 hover:bg-red-500/5'}`}
                            >
                              <Heart className={`w-4 h-4 ${item.isFavourite ? 'fill-red-500' : ''}`} />
                            </button>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/50 border border-slate-800 rounded-full">
                               <Sparkles className="w-3 h-3 text-blue-500" />
                               <span className="text-[9px] font-black text-slate-400">{item.relevanceScore}%</span>
                            </div>
                          </div>
                        </div>

                        <h3 className={`text-lg font-bold leading-tight mb-2 ${item.itemType === 'manual' ? 'text-blue-100' : 'text-slate-100'} line-clamp-2`}>
                          {item.title}
                        </h3>
                        <p className="text-sm text-slate-400 line-clamp-2 font-medium leading-relaxed">
                          {item.summary}
                        </p>

                        <div className="flex items-center justify-between mt-6">
                           <div className="flex items-center gap-4">
                             <button
                               onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                               className="text-[10px] font-black text-slate-500 hover:text-slate-200 uppercase tracking-widest flex items-center gap-2 transition-colors"
                             >
                               <Info className="w-3.5 h-3.5" />
                               Intelligence Briefing
                             </button>
                           </div>
                           
                           {item.url ? (
                             <a 
                               href={item.url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               onClick={(e) => e.stopPropagation()}
                               className="flex items-center gap-2 text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
                             >
                               Visit
                               <ExternalLink className="w-3 h-3" />
                             </a>
                           ) : (
                             <button className="flex items-center gap-2 text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors">
                               View Report
                               {expandedManualId === item.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                             </button>
                           )}
                        </div>

                        {/* Expanded Manual Report Citations */}
                        {item.itemType === 'manual' && expandedManualId === item.id && item.raw_data?.citations && (
                           <div className="mt-8 pt-8 border-t border-slate-800/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
                             <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">Citations & Hard Evidence</p>
                             {item.raw_data.citations.map((cit: any, i: number) => (
                               <div key={i} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                                 <h4 className="text-sm font-bold text-slate-200 mb-1">{cit.headline || cit.title}</h4>
                                 <p className="text-xs text-slate-500 line-clamp-1">{cit.summary}</p>
                                 <a href={cit.url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-2 block hover:underline">Source Link</a>
                               </div>
                             ))}
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
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

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Heart, Search, Info, ExternalLink, Activity, 
  Layers, Clock, Filter, Globe, Sparkles,
  ChevronDown, ChevronUp, Zap, FileText, CheckCircle2,
  Star
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RelevanceModal from '../components/RelevanceModal';
import CompanySwitcher from '../components/CompanySwitcher';

interface FavouriteItem {
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
  itemType: 'automated' | 'manual';
  raw_data?: any;
}

export default function Favourites() {
  const { profile, currentCompany, authLoading } = useAuth();
  const [items, setItems] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FavouriteItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedManualId, setExpandedManualId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadFavourites();
    }
  }, [profile?.id, currentCompany?.id, authLoading]);

  const loadFavourites = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Favourited Automated Updates
      let updatesQuery = supabase
        .from('updates')
        .select('*')
        .eq('is_favourite', true);
      
      if (currentCompany?.id) {
        updatesQuery = updatesQuery.eq('company_id', currentCompany.id);
      } else {
        updatesQuery = updatesQuery.eq('profile_id', profile.id);
      }

      // 2. Fetch Favourited Manual Scan Summaries
      let scansQuery = supabase
        .from('scan_summaries')
        .select('*')
        .eq('is_favourite', true);

      if (currentCompany?.id) {
        scansQuery = scansQuery.eq('company_id', currentCompany.id);
      } else {
        scansQuery = scansQuery.eq('profile_id', profile.id);
      }

      const [updatesRes, scansRes] = await Promise.all([updatesQuery, scansQuery]);

      if (updatesRes.error) throw updatesRes.error;
      if (scansRes.error) throw scansRes.error;

      const automatedItems: FavouriteItem[] = (updatesRes.data || []).map(u => ({
        id: u.id,
        title: u.title,
        summary: u.summary,
        url: u.url,
        source: u.source_name || 'Automated Feed',
        date: u.published_at || u.created_at,
        relevanceScore: u.relevance_score || 0,
        relevanceReasoning: u.relevance_reasoning || '',
        contentType: u.content_type || 'intelligence',
        isFavourite: true,
        itemType: 'automated'
      }));

      const manualItems: FavouriteItem[] = (scansRes.data || []).map(s => ({
        id: s.id,
        title: `Deep Research Report: ${new Date(s.scan_date).toLocaleDateString()}`,
        summary: s.overview,
        url: null,
        source: 'Deep Research',
        date: s.scan_date,
        relevanceScore: 100,
        relevanceReasoning: 'Strategic intelligence report marked for priority review.',
        contentType: s.content_type || 'strategic-report',
        isFavourite: true,
        itemType: 'manual',
        raw_data: s
      }));

      const combined = [...automatedItems, ...manualItems].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setItems(combined);
    } catch (err) {
      console.error('Failed to load favourites:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeFavourite = async (item: FavouriteItem) => {
    try {
      const table = item.itemType === 'automated' ? 'updates' : 'scan_summaries';
      const { error } = await supabase
        .from(table)
        .update({ is_favourite: false })
        .eq('id', item.id);
      
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error('Error removing favourite:', err);
    }
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
      <Sidebar activePage="favourites" />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <header className="px-8 h-24 bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50 z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 shadow-xl">
              <Heart className="w-6 h-6 text-red-500 fill-red-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 leading-none">
                Favourites
              </h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
                Priority Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <CompanySwitcher />
          </div>
        </header>

        <div className="h-16 border-b border-slate-800/30 flex items-center px-8 bg-slate-900/30 backdrop-blur-sm z-10">
          <div className="flex-1 relative flex items-center">
            <Search className="absolute left-0 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Searching priority records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-300 pl-7 placeholder:text-slate-600 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto pb-32">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                 <div className="w-12 h-12 border-2 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                 <p className="text-slate-500 font-black uppercase tracking-widest animate-pulse">Syncing Priority Feed...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="glass-card border-dashed border-2 border-slate-800/50 bg-slate-900/20 rounded-[40px] p-32 text-center">
                 <div className="w-24 h-24 bg-slate-950 border border-slate-800 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                    <Star className="w-12 h-12 text-slate-800" />
                 </div>
                 <h2 className="text-2xl font-bold text-white mb-3">No Favourites Yet</h2>
                 <p className="text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed font-medium">
                    Mark critical findings with a heart to preserve them in this priority repository.
                 </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredItems.map((item) => (
                  <div 
                    key={item.id}
                    className={`glass-card group relative p-8 border transition-all duration-300 bg-slate-900/40 border-slate-800/50 hover:border-blue-500/30 flex flex-col`}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-[0.2em] border ${
                          item.itemType === 'manual' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {item.source}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                          {new Date(item.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => removeFavourite(item)}
                        className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all border border-red-500/20"
                      >
                        <Heart className="w-4 h-4 fill-red-500" />
                      </button>
                    </div>

                    <h3 className="text-xl font-bold leading-tight mb-4 text-white group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8 flex-1">
                      {item.summary}
                    </p>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-800/50">
                       <button
                         onClick={() => setSelectedItem(item)}
                         className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                       >
                         <Info className="w-4 h-4" />
                         Analysis
                       </button>
                       
                       {item.url ? (
                         <a 
                           href={item.url} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="flex items-center gap-2 text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
                         >
                           Source
                           <ExternalLink className="w-3.5 h-3.5" />
                         </a>
                       ) : (
                         <button 
                           onClick={() => navigate('/scans')}
                           className="flex items-center gap-2 text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
                         >
                           View Scan
                           <Activity className="w-3.5 h-3.5" />
                         </button>
                       )}
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

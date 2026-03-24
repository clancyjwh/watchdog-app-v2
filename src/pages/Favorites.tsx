import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Heart, Zap, Info, ExternalLink, Activity, 
  Layers, Clock, TrendingUp, Search,
  ShieldCheck, Sparkles, ChevronRight, Newspaper, Globe,
  Share2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RelevanceModal from '../components/RelevanceModal';
import Toast from '../components/Toast';
import CompanySwitcher from '../components/CompanySwitcher';

interface UnifiedArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  relevanceScore: number;
  relevanceReasoning: string;
  type: string;
  isSaved: boolean;
  isRead: boolean;
}

export default function Favorites() {
  const { profile, currentCompany, loading: authLoading } = useAuth();
  const [articles, setArticles] = useState<UnifiedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<UnifiedArticle | null>(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadFavorites();
    }
  }, [profile?.id, currentCompany?.id, authLoading]);

  const loadFavorites = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('updates')
        .select('*')
        .eq('is_saved', true)
        .order('published_at', { ascending: false });
      
      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      } else {
        query = query.eq('profile_id', profile.id);
      }

      const { data: updates, error } = await query;

      if (error) throw error;

      const unified: UnifiedArticle[] = updates?.map(u => ({
        id: u.id,
        title: u.title,
        summary: u.summary,
        url: u.url,
        source: u.source_name || 'Web',
        publishedAt: u.published_at || u.created_at,
        relevanceScore: u.relevance_score || 0,
        relevanceReasoning: u.relevance_reasoning || '',
        type: u.content_type || 'news',
        isSaved: true,
        isRead: u.is_read || false,
      })) || [];

      setArticles(unified);
    } catch (err) {
      console.error('Failed to load favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (id: string) => {
    const { error } = await supabase
      .from('updates')
      .update({ is_saved: false })
      .eq('id', id);
    
    if (!error) {
      setArticles(prev => prev.filter(a => a.id !== id));
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex h-screen bg-[#020617] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Accessing Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <Sidebar activePage="favorites" />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

        <header className="h-20 border-b border-slate-800/50 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20 shadow-lg shadow-rose-500/5">
              <Heart className="w-6 h-6 text-rose-400 fill-rose-400/20" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 leading-none">Intelligence Vault</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Curated Strategic Assets</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <CompanySwitcher />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto pb-20">
            {articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center glass-card border-dashed border-2 border-slate-800/50 bg-slate-900/20 rounded-[40px]">
                <div className="w-20 h-20 bg-slate-950 border border-slate-800 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
                  <Heart className="w-10 h-10 text-slate-800" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Vault is currently empty</h3>
                <p className="text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                  Add high-value intelligence from your feed to build your strategic knowledge base.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-rose-400" />
                  </div>
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Validated Intelligence Pieces</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent ml-4" />
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {articles.map((article) => (
                    <div key={article.id} className="glass-card group hover:bg-slate-900/60 transition-all duration-500 border border-slate-800/50 hover:border-rose-500/20 flex flex-col sm:flex-row gap-8 p-8 items-center bg-slate-900/30 shadow-lg">
                      <div className="w-48 h-32 rounded-2xl bg-slate-950 border border-slate-800 flex-shrink-0 flex items-center justify-center relative overflow-hidden group-hover:border-rose-500/30 transition-colors">
                        <Globe className="w-8 h-8 text-slate-800 group-hover:text-rose-500/20 transition-all duration-500" />
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-rose-600/0 via-rose-600/20 to-rose-600/0 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] rounded border border-slate-700">
                              {article.source}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                              {new Date(article.publishedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-full">
                            <Sparkles className="w-3 h-3 text-rose-400" />
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-tighter">{article.relevanceScore}% SIGNAL</span>
                          </div>
                        </div>

                        <h3 className="text-xl font-bold text-slate-100 group-hover:text-rose-400 transition-colors leading-tight line-clamp-2">
                          <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{article.title}</a>
                        </h3>

                        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed font-medium">{article.summary}</p>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-6">
                            <button 
                              onClick={() => removeFavorite(article.id)} 
                              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-400 transition-all group/fav"
                            >
                              <Heart className="w-4 h-4 fill-rose-400" />
                              Remove from Vault
                            </button>
                            <button 
                              onClick={() => setSelectedArticle(article)}
                              className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                            >
                              <Info className="w-4 h-4" />
                              Intelligence Note
                            </button>
                          </div>

                          <div className="flex items-center gap-4">
                            <button className="p-2 text-slate-500 hover:text-slate-200 transition-colors">
                              <Share2 className="w-4 h-4" />
                            </button>
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-slate-100 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-xl hover:shadow-rose-500/20 active:scale-95">
                              Open Source
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedArticle && (
        <RelevanceModal
          isOpen={!!selectedArticle}
          onClose={() => setSelectedArticle(null)}
          title={selectedArticle.title}
          relevanceScore={selectedArticle.relevanceScore}
          reasoning={selectedArticle.relevanceReasoning}
        />
      )}

      {showToast && <Toast message="Vault updated" onClose={() => setShowToast(false)} />}
    </div>
  );
}

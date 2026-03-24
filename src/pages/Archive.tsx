import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Archive as ArchiveIcon, 
  Search, Info, ExternalLink, Activity, 
  Layers, Clock, Heart, Filter, Globe, Sparkles
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

export default function Archive() {
  const { profile, currentCompany, authLoading } = useAuth();
  const [articles, setArticles] = useState<UnifiedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<UnifiedArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'relevance'>('newest');

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadArchive();
    }
  }, [profile?.id, currentCompany?.id, authLoading]);

  const loadArchive = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      let query = supabase
        .from('updates')
        .select('*')
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
        isSaved: u.is_saved || false,
        isRead: u.is_read || false,
      })) || [];

      setArticles(unified);
    } catch (err) {
      console.error('Failed to load archive:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = useMemo(() => {
    return articles
      .filter(a => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        a.source.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'relevance') return b.relevanceScore - a.relevanceScore;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }, [articles, searchQuery, sortBy]);

  if (loading || authLoading) {
    return (
      <div className="flex h-screen bg-[#020617] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Syncing Archive...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <Sidebar activePage="archive" />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

        <header className="h-20 border-b border-slate-800/50 flex flex-col justify-center px-8 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 shadow-lg">
                <ArchiveIcon className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 leading-none">Intelligence Archive</h1>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Historical Signal Database</p>
              </div>
            </div>
            <CompanySwitcher />
          </div>
        </header>

        <div className="h-16 border-b border-slate-800/30 flex items-center px-8 bg-slate-900/30">
          <div className="flex-1 relative flex items-center">
            <Search className="absolute left-0 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search through historical records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-300 pl-7 placeholder:text-slate-600 outline-none"
            />
          </div>
          <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800 shadow-inner ml-4">
              <button
                onClick={() => setSortBy('newest')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  sortBy === 'newest' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Date
              </button>
              <button
                onClick={() => setSortBy('relevance')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  sortBy === 'relevance' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Score
              </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto pb-20">
            {filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center glass-card border-dashed border-2 border-slate-800/50 bg-slate-900/20 rounded-[40px]">
                <div className="w-20 h-20 bg-slate-950 border border-slate-800 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
                  <Search className="w-10 h-10 text-slate-800" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">No matching records</h3>
                <p className="text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                  Refine your search parameters or check a different company profile.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {filteredArticles.map((article) => (
                  <div key={article.id} className="glass-card group hover:bg-slate-900/60 transition-all duration-500 border border-slate-800/50 hover:border-slate-700/50 flex flex-col sm:flex-row gap-8 p-8 items-center bg-slate-900/30 shadow-lg">
                    <div className="w-48 h-32 rounded-2xl bg-slate-950 border border-slate-800 flex-shrink-0 flex items-center justify-center relative overflow-hidden group-hover:border-blue-500/10 transition-colors">
                      <Globe className="w-8 h-8 text-slate-800 group-hover:text-blue-500/10 transition-all duration-500" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] rounded border border-slate-700">
                            {article.source}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {new Date(article.publishedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full">
                          <Sparkles className="w-3 h-3 text-slate-400" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{article.relevanceScore}% RELEVANCE</span>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors leading-tight line-clamp-2">
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{article.title}</a>
                      </h3>

                      <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed font-medium">{article.summary}</p>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={() => setSelectedArticle(article)}
                            className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                          >
                            <Info className="w-4 h-4" />
                            Reasoning
                          </button>
                          {article.isSaved && (
                            <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest">
                              <Heart className="w-4 h-4 fill-rose-500" />
                              Vaulted
                            </div>
                          )}
                        </div>

                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-slate-800/80 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 hover:text-white transition-all border border-slate-700">
                          View Original
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
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
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ScanSummary } from '../lib/supabase';
import {
  Zap, Heart, ChevronRight,
  Archive, Clock, Sparkles,
  Layers, Share2, BookOpen, Globe, AlertCircle, Newspaper
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import CompanySwitcher from '../components/CompanySwitcher';
import Toast from '../components/Toast';
import RelevanceModal from '../components/RelevanceModal';

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
  batchId?: string;
  scanId?: string;
}

export default function Updates() {
  const { profile, currentCompany, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [articles, setArticles] = useState<UnifiedArticle[]>([]);
  const [scanSummaries, setScanSummaries] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'automated' | 'manual'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'oldest'>('relevance');
  const [showToast, setShowToast] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<UnifiedArticle | null>(null);
  const [stats, setStats] = useState({ total: 0, new: 0, sources: 0 });

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadIntelligence();
    }
  }, [profile?.id, currentCompany?.id, authLoading]);

  const loadIntelligence = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      // 1. Fetch Scheduled Updates (Automated)
      let updatesQuery = supabase
        .from('updates')
        .select('*')
        .order('published_at', { ascending: false });
      
      if (currentCompany?.id) {
        updatesQuery = updatesQuery.eq('company_id', currentCompany.id);
      } else {
        updatesQuery = updatesQuery.eq('profile_id', profile.id);
      }
      
      const { data: updates, error: updatesError } = await updatesQuery;

      // 2. Fetch Manual Scans
      let scansQuery = supabase
        .from('scan_summaries')
        .select('*')
        .order('scan_date', { ascending: false });
      
      if (currentCompany?.id) {
        scansQuery = scansQuery.eq('company_id', currentCompany.id);
      } else {
        scansQuery = scansQuery.eq('profile_id', profile.id);
      }
      
      const { data: scans, error: scansError } = await scansQuery;

      // 3. Fetch Sources Count
      const { count: sourcesCount } = await supabase
        .from('sources')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profile.id);

      if (updatesError || scansError) throw updatesError || scansError;

      // 4. Transform and Merge
      const unified: UnifiedArticle[] = [];

      updates?.forEach(u => {
        unified.push({
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
          batchId: u.delivery_batch
        });
      });

      scans?.forEach(scan => {
        scan.citations?.forEach((cit: any, idx: number) => {
          unified.push({
            id: `${scan.id}-${idx}`,
            title: cit.title,
            summary: cit.summary || scan.overview || '',
            url: cit.url,
            source: cit.source_name || (cit.url ? new URL(cit.url).hostname.replace('www.', '') : 'Research'),
            publishedAt: scan.scan_date,
            relevanceScore: cit.relevance_score || scan.relevance_score || 70,
            relevanceReasoning: cit.relevance_reasoning || scan.relevance_reasoning || '',
            type: 'report',
            isSaved: false,
            isRead: scan.is_read || false,
            scanId: scan.id
          });
        });
      });

      // Deduplicate
      const seen = new Set();
      const finalArticles = unified.filter(a => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
      });

      setArticles(finalArticles);
      setScanSummaries(scans || []);
      setStats({
        total: finalArticles.length,
        new: finalArticles.filter(a => !a.isRead).length,
        sources: sourcesCount || 0
      });

    } catch (err) {
      console.error('Failed to load intelligence:', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedArticles = useMemo(() => {
    // Filter
    let filtered = articles.filter(article => {
      if (filter === 'all') return true;
      if (filter === 'automated') return !article.scanId;
      if (filter === 'manual') return !!article.scanId;
      return true;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'relevance') return b.relevanceScore - a.relevanceScore;
      if (sortBy === 'newest') return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
    });

    const groups = new Map<string, UnifiedArticle[]>();
    sorted.forEach(article => {
      const date = new Date(article.publishedAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      let group = 'Older Intelligence';
      if (diffDays === 0) group = 'Today\'s Intelligence';
      else if (diffDays === 1) group = 'Yesterday\'s Findings';
      else if (diffDays < 7) group = 'This Week';
      
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(article);
    });
    
    return groups;
  }, [articles, filter, sortBy]);

  const handleSaveArticle = async (id: string, currentlySaved: boolean) => {
    try {
      if (id.includes('-')) {
        setArticles(prev => prev.map(a => a.id === id ? { ...a, isSaved: !currentlySaved } : a));
        return;
      }
      const { error } = await supabase
        .from('updates')
        .update({ is_saved: !currentlySaved })
        .eq('id', id);
      if (error) throw error;
      setArticles(prev => prev.map(a => a.id === id ? { ...a, isSaved: !currentlySaved } : a));
      if (!currentlySaved) setShowToast(true);
    } catch (err) {
      console.error('Error saving article:', err);
    }
  };

  const handleArchiveArticle = async (id: string, currentlyRead: boolean) => {
    try {
      if (id.includes('-')) {
        setArticles(prev => prev.map(a => a.id === id ? { ...a, isRead: !currentlyRead } : a));
        return;
      }
      const { error } = await supabase
        .from('updates')
        .update({ is_read: !currentlyRead })
        .eq('id', id);
      if (error) throw error;
      setArticles(prev => prev.map(a => a.id === id ? { ...a, isRead: !currentlyRead } : a));
    } catch (err) {
      console.error('Error archiving article:', err);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex h-screen bg-[#020617] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Synchronizing Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <Sidebar activePage="updates" />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

        <header className="h-20 border-b border-slate-800/50 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
              <Newspaper className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 leading-none">Intelligence Feed</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Strategic Monitoring Hub</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
              {(['all', 'automated', 'manual'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 uppercase tracking-widest ${
                    filter === t 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t === 'all' ? 'All Signals' : t === 'automated' ? 'Automated' : 'Deep Scans'}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <CompanySwitcher />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-16 pb-20">
            
            {filter !== 'automated' && scanSummaries.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Strategic Research Analysis</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent ml-4" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {scanSummaries.map((summary) => (
                    <div key={summary.id} className="glass-card group hover:scale-[1.02] transition-all duration-500 border border-slate-800/50 hover:border-blue-500/30 overflow-hidden flex flex-col h-full bg-slate-900/40 backdrop-blur-sm shadow-xl hover:shadow-blue-500/5">
                      <div className="p-6 flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-tighter rounded border border-blue-500/20">
                            {summary.content_type || 'Deep Research'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            {new Date(summary.scan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-100 text-lg leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                          {summary.summary_text.split('\n')[0].replace(/^#+\s*/, '')}
                        </h3>
                        <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed font-medium">
                          {summary.overview || summary.summary_text.substring(0, 150) + '...'}
                        </p>
                      </div>
                      <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                          <span>{summary.article_count} Evidence Points</span>
                        </div>
                        <button 
                          onClick={() => navigate(`/research?id=${summary.id}`)}
                          className="text-[10px] font-black text-blue-400 hover:text-white flex items-center gap-2 transition-all uppercase tracking-[0.1em] group/btn"
                        >
                          Synthesize <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {filter !== 'manual' && Array.from(groupedArticles.entries()).map(([interval, intervalArticles]) => (
              <section key={interval} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-400" />
                  </div>
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">{interval}</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent ml-4" />
                </div>

                <div className="space-y-6">
                  {intervalArticles.map((article) => (
                    <div key={article.id} className="glass-card group hover:bg-slate-900/60 transition-all duration-500 border border-slate-800/50 hover:border-slate-700/50 flex flex-col sm:flex-row gap-8 p-8 items-center bg-slate-900/30 shadow-lg">
                      <div className="w-48 h-32 rounded-2xl bg-slate-950 border border-slate-800 flex-shrink-0 flex items-center justify-center relative overflow-hidden group-hover:border-blue-500/30 transition-colors">
                        <Globe className="w-8 h-8 text-slate-800 group-hover:text-blue-500/20 transition-all duration-500" />
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-600/0 via-blue-600/20 to-blue-600/0 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
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
                          {article.relevanceScore >= 80 && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">{article.relevanceScore}% SIGNAL</span>
                            </div>
                          )}
                        </div>

                        <h3 className="text-xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors leading-tight line-clamp-2">
                          <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{article.title}</a>
                        </h3>

                        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed font-medium">{article.summary}</p>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-6">
                            <button 
                              onClick={() => handleSaveArticle(article.id, article.isSaved)} 
                              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                article.isSaved ? 'text-amber-400 scale-105' : 'text-slate-500 hover:text-amber-400'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${article.isSaved ? 'fill-amber-400' : ''}`} />
                              {article.isSaved ? 'Favourited' : 'Favourite'}
                            </button>
                            <button 
                              onClick={() => handleArchiveArticle(article.id, article.isRead)} 
                              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                                article.isRead ? 'text-blue-400' : 'text-slate-500 hover:text-blue-400'
                              }`}
                            >
                              <Archive className="w-4 h-4" />
                              {article.isRead ? 'Restore' : 'Archive'}
                            </button>
                            <button 
                              onClick={() => setSelectedArticle(article)}
                              className="flex items-center gap-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                            >
                              <Info className="w-4 h-4" />
                              Why This?
                            </button>
                          </div>

                          <div className="flex items-center gap-4">
                            <button className="p-2 text-slate-500 hover:text-slate-200 transition-colors">
                              <Share2 className="w-4 h-4" />
                            </button>
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-slate-100 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-xl hover:shadow-blue-500/20 active:scale-95">
                              Extract Intelligence
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {Array.from(groupedArticles.entries()).length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-32 text-center glass-card border-dashed border-2 border-slate-800/50 bg-slate-900/20 rounded-[40px]">
                <div className="w-20 h-20 bg-slate-950 border border-slate-800 rounded-3xl flex items-center justify-center mb-8 shadow-2xl">
                  <AlertCircle className="w-10 h-10 text-slate-700" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Feed is silent</h3>
                <p className="text-slate-500 max-w-sm mx-auto leading-relaxed font-medium">
                  We haven't detected any new signals matching your strategic interests in this period.
                </p>
                <button 
                  onClick={() => navigate('/settings')}
                  className="mt-10 px-8 py-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-600 hover:text-white transition-all duration-300"
                >
                  Adjust Tracking Parameters
                </button>
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

      {showToast && <Toast message="Article updated in your intelligence vault" onClose={() => setShowToast(false)} />}
    </div>
  );
}

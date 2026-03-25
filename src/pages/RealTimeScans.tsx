import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, ScanSummary } from '../lib/supabase';
import {
  Activity, Search, ExternalLink, LogOut, Settings, CreditCard,
  BarChart3, Heart, Zap, Monitor, FileText, ChevronDown, ChevronUp,
  Sparkles, TrendingUp, Info, ShieldAlert, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { triggerScannerWebhook } from '../utils/pricing';
import Sidebar from '../components/Sidebar';
import RelevanceModal from '../components/RelevanceModal';

export default function RealTimeScans() {
  const { user, profile, currentCompany, isAdmin, effectiveCredits, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [scanSummaries, setScanSummaries] = useState<ScanSummary[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);

  const loadScanSummaries = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('scan_summaries')
      .select('*')
      .eq('profile_id', profile.id)
      .order('scan_date', { ascending: false });

    if (error) {
      console.error('Error loading scan summaries:', error);
      return;
    }

    if (data) {
      setScanSummaries(data);
      if (data.length > 0 && expandedDates.size === 0) {
        setExpandedDates(new Set([data[0].scan_date]));
      }
    }
  };

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadScanSummaries();

      // Subscribe to real-time updates for new research reports
      const channel = supabase
        .channel('scan_summaries_updates')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'scan_summaries',
          filter: `profile_id=eq.${profile.id}`
        }, async (payload) => {
          console.log('New research report received:', payload.new);
          await loadScanSummaries();
          // We don't set scanLoading(false) here because runManualScan handles it with the progress bar logic
        })
        .subscribe();

      // Sync local loading state with database is_scanning flag
      if (currentCompany?.is_scanning) {
        setScanLoading(true);
        // Start a progress bar if we just found out it's scanning
        // (Though ideally the user who triggered it has the active timer)
      }

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id, currentCompany?.id, authLoading]);

  const runManualScan = async () => {
    if (!profile?.id || !user?.id) return;
    
    setScanLoading(true);
    setProgress(0);

    // Initial Progress Setup (40s simulation to 95%)
    const duration = 40000;
    const intervalTime = 500;
    const steps = duration / intervalTime;
    const increment = 95 / steps;

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95;
        return prev + increment;
      });
    }, intervalTime);

    try {
      const { data: topicsData } = await supabase.from('topics').select('*').eq('company_id', currentCompany.id);
      const topics = topicsData?.map(t => t.topic_name) || [];

      if (topics.length === 0) {
        alert('Please configure your topics in Settings before running a scan.');
        clearInterval(progressInterval);
        setScanLoading(false);
        setProgress(0);
        return;
      }

      // Start the scan
      await supabase.from('companies').update({ is_scanning: true }).eq('id', currentCompany.id);

      const result = await triggerScannerWebhook(
        user.id, 
        currentCompany?.subscription_frequency || 'weekly', 
        true,
        {
          company_name: currentCompany?.name,
          industry: currentCompany?.industry,
          description: currentCompany?.description,
          monitoring_goals: currentCompany?.monitoring_goals,
          topics: topics,
          full_name: profile?.full_name,
          email: profile?.email,
          location: `${currentCompany?.location_city}, ${currentCompany?.location_province}, ${currentCompany?.location_country}`
        }
      );

      if (result) {
        clearInterval(progressInterval);
        setProgress(100);

        let extractedData: any = {};
        try {
          const rawTopStories = result['Top Stories'] || result.top_stories_json || result.data;
          extractedData = typeof rawTopStories === 'string' ? JSON.parse(rawTopStories) : rawTopStories;
        } catch (e) {
          console.error("Failed to parse research data:", e);
        }

        const stories = extractedData?.top_stories || [];
        const citations = stories.map((s: any, idx: number) => ({
          number: idx + 1,
          title: s.headline || s.title || 'Untitled Report',
          url: s.url || '#',
          source: s.source_name || 'Autonomous Agent',
          relevance_score: s.relevance_score_0_100 || s.relevance_score || 85,
          summary: s.summary || '',
          content_type: s.content_type || 'intelligence',
          primary_label: s.primary_label || 'Insight',
          key_insights: s.key_insights || [],
          next_steps: s.next_steps || [],
          is_favourite: false
        }));

        await supabase.from('scan_summaries').insert({
          profile_id: profile.id,
          company_id: currentCompany?.id,
          content_type: 'Manual Scan',
          overview: stories[0]?.summary || 'Deep intelligence scan completed successfully.',
          summary_text: stories[0]?.summary || '',
          key_insights: stories[0]?.key_insights || [],
          citations: citations,
          article_count: stories.length,
          scan_date: new Date().toISOString(),
          is_read: false,
          is_favourite: false
        });

        await supabase.from('companies').update({ is_scanning: false }).eq('id', currentCompany.id);
        await loadScanSummaries();
        
        // Brief delay at 100% for satisfaction
        setTimeout(() => {
          setScanLoading(false);
          setProgress(0);
        }, 1500);
        return;
      }
    } catch (error) {
      console.error('Scan error:', error);
      clearInterval(progressInterval);
      setScanLoading(false);
      setProgress(0);
      alert('Failed to initialize scan.');
    }
  };

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) newSet.delete(date);
      else newSet.add(date);
      return newSet;
    });
  };

  const handleFavouriteReport = async (id: string, currentlyFavourite: boolean) => {
    try {
      const { error } = await supabase
        .from('scan_summaries')
        .update({ is_favourite: !currentlyFavourite })
        .eq('id', id);
      if (error) throw error;
      setScanSummaries(prev => prev.map(s => s.id === id ? { ...s, is_favourite: !currentlyFavourite } : s));
    } catch (err) {
      console.error('Error favouriting report:', err);
    }
  };

  if (authLoading) return null;

  return (
    <div className="flex bg-[#020617] min-h-screen text-slate-200 font-sans overflow-hidden">
      <Sidebar activePage="research" />

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <header className="px-8 h-24 bg-slate-900/50 backdrop-blur-md border-b border-slate-800/50 z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 leading-none">
                Deep Research
              </h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
                On-demand AI Strategic Analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 opacity-60">Scan Capacity</span>
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-950/80 border border-slate-800/50 rounded-xl shadow-inner group">
                <span className="text-sm font-black text-blue-400 font-mono tracking-tight">
                  {isAdmin ? 'UNLIMITED' : effectiveCredits}
                </span>
                <CreditCard className="w-3.5 h-3.5 text-blue-500 group-hover:animate-pulse" />
              </div>
            </div>
            
            <button
              onClick={runManualScan}
              disabled={scanLoading || (!isAdmin && effectiveCredits < 25)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
            >
              {scanLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Search className="w-4 h-4" />
              )}
              Initialize Deep Scan
            </button>
          </div>
        </header>

        {/* Progress Bar Overlay */}
        {scanLoading && (
          <div className="absolute top-24 left-0 w-full h-1 bg-slate-900 z-50 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]"
              style={{ width: `${progress}%` }}
            />
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-full shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 flex items-center gap-3">
               <div className="flex gap-1">
                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                 <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
               </div>
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                 {progress < 100 ? `Synthesizing Intelligence... ${Math.round(progress)}%` : 'Intelligence Normalized. Finalizing...'}
               </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            {scanSummaries.length === 0 ? (
              <div className="glass-card border-dashed border-2 border-slate-800/50 bg-slate-900/20 rounded-[40px] p-32 text-center animate-in fade-in duration-1000">
                 <div className="w-24 h-24 bg-slate-950 border border-slate-800 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                    <Zap className="w-12 h-12 text-slate-700 animate-pulse" />
                 </div>
                 <h2 className="text-2xl font-bold text-white mb-3">No Deep Research Initiated</h2>
                 <p className="text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed font-medium">
                    Trigger your first manual scan to uncover deep insights across the web tailored to your strategic goals.
                 </p>
              </div>
            ) : (
              <div className="space-y-8 pb-32">
                {scanSummaries.map((summary) => {
                  const isExpanded = expandedDates.has(summary.scan_date);
                  return (
                    <div 
                      key={summary.id} 
                      className={`glass-card group overflow-hidden transition-all duration-500 border ${
                        isExpanded ? 'border-blue-500/30 bg-slate-900/60 shadow-2xl' : 'border-slate-800/50 hover:border-slate-700 bg-slate-900/30'
                      }`}
                    >
                      <button
                        onClick={() => toggleDateExpansion(summary.scan_date)}
                        className="w-full flex items-center justify-between p-8 text-left relative overflow-hidden"
                      >
                         {isExpanded && (
                           <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                         )}
                        <div className="flex items-center gap-8">
                           <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center border transition-all duration-500 ${
                             isExpanded ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-950 border-slate-800 text-slate-400'
                           }`}>
                              <span className="text-[10px] font-black uppercase leading-none opacity-60">
                                {new Date(summary.scan_date).toLocaleDateString('en-US', { month: 'short' })}
                              </span>
                              <span className="text-2xl font-black leading-none mt-1">
                                {new Date(summary.scan_date).getDate()}
                              </span>
                           </div>
                           <div>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg">
                                  Manual Report
                                </span>
                                <span className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.15em]">
                                  {summary.content_type} • {summary.article_count} High-Signal Citations
                                </span>
                              </div>
                              <h3 className="text-2xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                                {new Date(summary.scan_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                              </h3>
                           </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleFavouriteReport(summary.id, !!summary.is_favourite); }}
                             className={`p-3 rounded-xl transition-all ${summary.is_favourite ? 'bg-red-500/10 text-red-500' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/5'}`}
                           >
                             <Heart className={`w-5 h-5 ${summary.is_favourite ? 'fill-red-500' : ''}`} />
                           </button>
                           {isExpanded ? <ChevronUp className="w-6 h-6 text-blue-400" /> : <ChevronDown className="w-6 h-6 text-slate-600" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-8 pb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                           <div className="bg-slate-950/50 rounded-3xl p-8 mb-10 border border-slate-800/50 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Sparkles className="w-32 h-32 text-blue-500" />
                              </div>
                              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6 flex items-center gap-3">
                                <Sparkles className="w-4 h-4 text-blue-500" />
                                Synthetic Overview
                              </h4>
                              <p className="text-lg text-slate-300 leading-relaxed font-medium italic relative z-10">
                                "{summary.overview}"
                              </p>
                              
                              {summary.social_sentiment && (
                                <div className="mt-8 pt-8 border-t border-slate-800/50">
                                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Market Sentiment Analysis</h4>
                                  <p className="text-base text-slate-400 font-medium leading-relaxed">
                                    {summary.social_sentiment}
                                  </p>
                                </div>
                              )}
                           </div>

                           <div className="space-y-6">
                              <div className="flex items-center justify-between px-2 mb-4">
                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Intelligence Evidence Points</h4>
                                <div className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/5">
                                  {summary.citations?.length || 0} Unified Findings
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-4">
                              {summary.citations
                                ?.sort((a: any, b: any) => (b.relevance_score || 0) - (a.relevance_score || 0))
                                ?.map((cit: any, i: number) => (
                                <div key={i} className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-6 hover:border-blue-500/30 transition-all duration-300 group/item relative overflow-hidden">
                                   <div className="absolute inset-y-0 left-0 w-0 group-hover/item:w-1 bg-blue-600 transition-all duration-300" />
                                   <div className="flex items-start justify-between gap-8">
                                      <div className="flex-1 min-w-0">
                                         <div className="flex items-center gap-3 mb-3">
                                            <span className="text-[9px] font-black px-2 py-1 bg-slate-800 text-slate-400 rounded uppercase tracking-[0.2em] border border-slate-700">
                                               {cit.content_type || 'intelligence'}
                                            </span>
                                            {cit.primary_label && (
                                               <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-[0.2em] border ${
                                                  cit.primary_label.toLowerCase() === 'risk' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                                                  cit.primary_label.toLowerCase() === 'opportunity' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                                  'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                               }`}>
                                                  {cit.primary_label}
                                               </span>
                                            )}
                                         </div>
                                         <h5 className="text-xl font-bold text-slate-100 group-hover/item:text-blue-400 transition-colors leading-tight line-clamp-2">
                                            {cit.headline || cit.title}
                                         </h5>
                                         <p className="text-sm text-slate-400 mt-3 line-clamp-2 font-medium leading-relaxed">
                                            {cit.summary}
                                         </p>
                                         <div className="flex items-center justify-between mt-6">
                                            <div className="flex items-center gap-4">
                                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                <Layers className="w-3 h-3" />
                                                {cit.url ? new URL(cit.url).hostname.replace('www.', '') : 'Internal Intelligence'}
                                              </span>
                                            </div>
                                            <a 
                                              href={cit.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="px-5 py-2 bg-slate-800 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 group/link shadow-lg"
                                            >
                                              Extract <ExternalLink className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                                            </a>
                                         </div>
                                      </div>
                                      <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center shadow-inner group-hover/item:border-blue-500/20 transition-colors">
                                           <span className="text-[8px] font-black text-slate-600 uppercase leading-none mb-1">SIGNAL</span>
                                           <span className="text-base font-black text-slate-200">{cit.relevance_score || 85}</span>
                                        </div>
                                      </div>
                                   </div>
                                </div>
                              ))}
                              </div>
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

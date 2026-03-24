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
    }
  }, [profile?.id, authLoading]);

  const runManualScan = async () => {
    if (!profile?.id || !user?.id) return;
    setScanLoading(true);

    try {
      // Use RPC but we know admin logic is handled in edge function or DB trigger usually
      // For UI, we already checked effectiveCredits in the button disabled state
      const { data: newBalance, error: spendError } = await supabase
        .rpc('spend_manual_scan_credits', { cost: 25 });

      if (spendError && !isAdmin) {
        alert('Not enough credits. Please upgrade or purchase more credits.');
        setScanLoading(false);
        return;
      }

      await refreshProfile();
      
      const { data: topicsData } = await supabase.from('topics').select('*').eq('company_id', currentCompany.id);
      const { data: sourcesData } = await supabase.from('sources').select('*').eq('profile_id', profile.id).eq('is_core_source', true);

      const topics = topicsData?.map(t => t.topic_name) || [];
      const sources = sourcesData || [];

      if (topics.length === 0) {
        alert('Please configure your topics in Settings before running a scan.');
        setScanLoading(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-perplexity-updates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topics,
          sources: sources.map(s => ({ name: s.name, url: s.url })),
          contentTypes: currentCompany?.content_types || ['news', 'legislation'],
          businessDescription: currentCompany?.description || '',
          industry: currentCompany?.industry || '',
          monitoringGoals: currentCompany?.monitoring_goals || '',
          dateFrom,
          dateTo: today
        }),
      });

      if (response.ok) {
        // Trigger the manual scan webhook
        await triggerScannerWebhook(user.id, currentCompany?.subscription_frequency || 'weekly', true);
        await loadScanSummaries();
        alert('Manual Research Scan Complete! New articles added to feed.');
      } else {
        throw new Error('Scan failed');
      }

    } catch (error) {
      console.error('Scan error:', error);
      alert('Failed to run scan. Please try again.');
    } finally {
      setScanLoading(false);
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

  if (authLoading) return null;

  return (
    <div className="flex bg-slate-50 min-h-screen text-slate-900">
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="px-8 py-6 bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-indigo-600 fill-indigo-600" />
              Strategic Research
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              On-demand AI analysis into your core areas of interest
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scan Capacity</p>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-lg font-black text-slate-900">
                  {isAdmin ? 'UNLIMITED' : effectiveCredits}
                </span>
                <CreditCard className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            
            <button
              onClick={runManualScan}
              disabled={scanLoading || (!isAdmin && effectiveCredits < 25)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-indigo-200 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {scanLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Search className="w-4 h-4" />
              )}
              Initialize Manual Scan
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          <div className="max-w-5xl mx-auto">
            {scanSummaries.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
                 <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-100">
                    <Zap className="w-10 h-10 text-indigo-600" />
                 </div>
                 <h2 className="text-xl font-bold text-slate-900">No Research Reports</h2>
                 <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                    Initialize your first manual research scan to uncover insights across the web tailored to your business goals.
                 </p>
              </div>
            ) : (
              <div className="space-y-6">
                {scanSummaries.map((summary) => {
                  const isExpanded = expandedDates.has(summary.scan_date);
                  return (
                    <div 
                      key={summary.id} 
                      className={`bg-white rounded-3xl border transition-all ${isExpanded ? 'border-indigo-600 shadow-xl' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <button
                        onClick={() => toggleDateExpansion(summary.scan_date)}
                        className="w-full flex items-center justify-between p-6 text-left"
                      >
                        <div className="flex items-center gap-6">
                           <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border-2 ${isExpanded ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                              <span className="text-[10px] font-black uppercase leading-none opacity-60">
                                {new Date(summary.scan_date).toLocaleDateString('en-US', { month: 'short' })}
                              </span>
                              <span className="text-xl font-black leading-none mt-1">
                                {new Date(summary.scan_date).getDate()}
                              </span>
                           </div>
                           <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">
                                  Manual Report
                                </span>
                                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                                  {summary.content_type} • {summary.article_count} Source Papers
                                </span>
                              </div>
                              <h3 className="text-xl font-black text-slate-900">
                                {new Date(summary.scan_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                              </h3>
                           </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-6 h-6 text-indigo-600" /> : <ChevronDown className="w-6 h-6 text-slate-400" />}
                      </button>

                      {isExpanded && (
                        <div className="px-6 pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                           <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                Executive Summary
                              </h4>
                              <p className="text-slate-700 leading-relaxed font-medium italic">
                                "{summary.overview}"
                              </p>
                              
                              {summary.social_sentiment && (
                                <div className="mt-6 pt-6 border-t border-slate-200/50">
                                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Market Sentiment</h4>
                                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                    {summary.social_sentiment}
                                  </p>
                                </div>
                              )}
                           </div>

                           <div className="space-y-4">
                              <div className="flex items-center justify-between px-2 mb-2">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Primary Intelligence Sources</h4>
                                <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-tight">
                                  {summary.citations?.length || 0} results found (Limit: {currentCompany?.results_per_scan || 5})
                                </div>
                              </div>
                              
                              {summary.citations
                                ?.sort((a: any, b: any) => (b.relevance_score || 0) - (a.relevance_score || 0))
                                ?.slice(0, currentCompany?.results_per_scan || 5)
                                ?.map((cit: any, i: number) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 transition-all hover:shadow-sm techny-border">
                                   <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                         <h5 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                            {cit.title}
                                         </h5>
                                         <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                            {cit.summary}
                                         </p>
                                         <div className="flex items-center gap-3 mt-4">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Source: {cit.url ? new URL(cit.url).hostname.replace('www.', '') : 'Internal'}</span>
                                            <a 
                                              href={cit.url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 uppercase tracking-widest"
                                            >
                                              External Paper <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                         </div>
                                      </div>
                                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs">
                                         {cit.relevance_score || 85}
                                      </div>
                                   </div>
                                </div>
                              ))}
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

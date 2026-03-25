import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, Save, Building2, Sparkles, X, Briefcase, Globe, Target, Shield, Info,
  ChevronRight, LogOut, CreditCard, Zap, Activity, CheckCircle2, Layers, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import CompanySwitcher from '../components/CompanySwitcher';
import { syncSettingsToWebhook } from '../utils/webhookSync';
import { generateTopicSuggestions } from '../utils/openai';
import { calculatePricing, type PricingConfig, getTierConfig, SubscriptionTier, formatCurrency } from '../utils/pricing';

type Topic = {
  id: string;
  topic_name: string;
  is_custom: boolean;
};

export default function SettingsPage() {
  const { profile, currentCompany, companies, refreshProfile, switchCompany, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationProvince, setLocationProvince] = useState('');
  const [locationCity, setLocationCity] = useState('');
  
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);

  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('biweekly');
  const [resultsPerScan, setResultsPerScan] = useState(10);
  const [analysisDepth, setAnalysisDepth] = useState<'standard' | 'deep'>('standard');

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadData();
    }
  }, [profile?.id, currentCompany?.id, authLoading]);

  const loadData = async () => {
    if (!profile?.id || !currentCompany) return;

    try {
      const { data: topicsRes } = await supabase.from('topics').select('*').eq('company_id', currentCompany.id);

      setCompanyName(currentCompany.name || '');
      setIndustry(currentCompany.industry || '');
      setBusinessDescription(currentCompany.description || '');
      setLocationCountry(currentCompany.location_country || '');
      setLocationProvince(currentCompany.location_province || '');
      setLocationCity(currentCompany.location_city || '');
      setResultsPerScan(currentCompany.results_per_scan || 10);
      setAnalysisDepth(currentCompany.analysis_depth || 'standard');
      
      if (currentCompany.subscription_frequency) {
        setFrequency(currentCompany.subscription_frequency);
      }

      setTopics(topicsRes || []);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handlePurchaseCredits = (credits: number) => {
    const links = {
      100: 'https://buy.stripe.com/7sY4gz9OA673d9xgztfMA00',
      300: 'https://buy.stripe.com/00w9AT5ykbrnc5tdnhfMA01',
      1000: 'https://buy.stripe.com/4gMfZh6Co52Z3yX1EzfMA02',
    };
    
    const url = links[credits as keyof typeof links];
    if (url && profile?.id) {
      const stripeUrl = new URL(url);
      stripeUrl.searchParams.set('client_reference_id', profile.id);
      if (user?.email) stripeUrl.searchParams.set('prefilled_email', user.email);
      window.location.href = stripeUrl.toString();
    }
  };

  const handleGetTopicSuggestions = async () => {
    setAiLoading(true);
    try {
      const suggestions = await generateTopicSuggestions(businessDescription, industry, []);
      setTopicSuggestions(suggestions?.map(s => s.topic) || ['Market Trends', 'Competitor Activity', 'Regulatory Updates']);
    } catch (error) {
      setTopicSuggestions(['Industry News', 'Regulatory Changes', 'Market Trends']);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddTopic = async () => {
    if (!newTopic.trim() || !currentCompany?.id) return;
    try {
      const { data } = await supabase.from('topics').insert({ 
        company_id: currentCompany.id, 
        profile_id: profile?.id,
        topic_name: newTopic.trim(), 
        is_custom: true 
      }).select().single();
      if (data) {
        setTopics([...topics, data]);
        setNewTopic('');
      }
    } catch (error) {}
  };

  const handleRemoveTopic = async (id: string) => {
    try {
      await supabase.from('topics').delete().eq('id', id);
      setTopics(topics.filter((t: Topic) => t.id !== id));
    } catch (error) {}
  };

  const handleSave = async () => {
    if (!profile?.id || !user || !currentCompany) return;
    setSaving(true);
    try {
      await supabase.from('companies').update({
        name: companyName,
        industry,
        description: businessDescription,
        location_country: locationCountry,
        location_province: locationProvince,
        location_city: locationCity,
        analysis_depth: analysisDepth,
        results_per_scan: resultsPerScan,
        subscription_frequency: frequency,
      }).eq('id', currentCompany.id);

      await supabase.from('profiles').update({ company_name: companyName }).eq('id', profile.id);
      
      await syncSettingsToWebhook({
        userId: user.id,
        email: user.email || '',
        companyId: currentCompany.id,
        companyName: companyName,
        industry,
        description: businessDescription,
        monitoringGoals: [],
        topics: topics.map((t: Topic) => t.topic_name),
        sources: [], 
        location: { country: locationCountry, province: locationProvince, city: locationCity },
        context: [],
      });

      await refreshProfile();
      alert('Settings saved!');
    } catch (error) {
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  const pricing = calculatePricing({
    tier: (profile?.subscription_tier as SubscriptionTier) || 'basic',
    contentTypeCount: 5,
    deliveryMethod: 'dashboard',
    deepAnalysis: analysisDepth === 'deep'
  });

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-6 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800/50 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Settings className="w-6 h-6 text-blue-500" />
              Settings
            </h1>
            <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">Configure your intelligence parameters</p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-10 py-8 scrollbar-hide">
          <div className="max-w-5xl mx-auto space-y-12 pb-20 text-left">
            
            {/* Company Selection */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-500" />
                    Global Profile
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Manage entity monitoring context</p>
                </div>
                <div className="flex items-center gap-4">
                  <CompanySwitcher />
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="p-2.5 bg-slate-900/40 border border-slate-800/50 rounded-xl hover:bg-slate-800/50 text-slate-400 transition-all shadow-sm"
                    title="Add New Entity"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {companies.map((company: any) => (
                  <button
                    key={company.id}
                    onClick={() => company.id !== currentCompany?.id && switchCompany(company.id)}
                    className={`group p-5 rounded-2xl border transition-all text-left relative overflow-hidden ${
                      company.id === currentCompany?.id
                        ? 'border-blue-500/50 bg-blue-500/5 shadow-lg shadow-blue-900/10'
                        : 'border-slate-800/50 bg-slate-900/20 hover:border-slate-700'
                    }`}
                  >
                    <h3 className="font-black text-sm mb-1">{company.name}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{company.industry}</p>
                    {company.id === currentCompany?.id && <div className="absolute top-0 right-0 p-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div></div>}
                  </button>
                ))}
              </div>

              <div className="bg-slate-900/40 border border-slate-800/50 rounded-3xl p-8 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Entity Name</label>
                      <input
                        value={companyName} onChange={e => setCompanyName(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Sector / Industry</label>
                      <input
                        value={industry} onChange={e => setIndustry(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 block">Operation Hub</label>
                      <div className="grid grid-cols-3 gap-3">
                        <input value={locationCountry} onChange={e => setLocationCountry(e.target.value)} placeholder="Country" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-xs font-bold focus:border-blue-500 outline-none" />
                        <input value={locationProvince} onChange={e => setLocationProvince(e.target.value)} placeholder="Prov/State" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-xs font-bold focus:border-blue-500 outline-none" />
                        <input value={locationCity} onChange={e => setLocationCity(e.target.value)} placeholder="City" className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-xs font-bold focus:border-blue-500 outline-none" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Strategic Context (Bio)</label>
                    <textarea
                      value={businessDescription} onChange={e => setBusinessDescription(e.target.value)} rows={7}
                      className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-3 font-bold focus:border-blue-500 outline-none transition-all resize-none text-sm text-slate-300 leading-relaxed"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Intelligence Topics */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-500" />
                    Intelligence Topics
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Refine the scope of your monitoring pipeline</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800/50 rounded-3xl p-8">
                  <div className="flex gap-2 mb-6">
                    <input
                      placeholder="Add custom topic (e.g. Rare Earth Metals)"
                      className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-3 font-bold focus:border-blue-500 outline-none transition-all text-sm"
                      value={newTopic} onChange={e => setNewTopic(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && handleAddTopic()}
                    />
                    <button onClick={handleAddTopic} className="bg-slate-800 hover:bg-slate-700 px-6 rounded-xl font-black text-xs uppercase transition-all">Add</button>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-8">
                    {topics.map(topic => (
                      <div key={topic.id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full group hover:border-blue-500/50 transition-all">
                        <span className="text-[10px] font-black uppercase tracking-tight text-blue-400">{topic.topic_name}</span>
                        <button onClick={() => handleRemoveTopic(topic.id)} className="text-blue-500/50 hover:text-rose-500 transition-all"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-slate-800/50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-black uppercase text-slate-500">AI Augmented Suggestions</span>
                      <button onClick={handleGetTopicSuggestions} disabled={aiLoading} className="text-[10px] font-black text-blue-500 hover:underline flex items-center gap-1">
                        {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Refresh
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {topicSuggestions.map(s => (
                        <button key={s} onClick={() => setNewTopic(s)} className="px-3 py-1 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all">+ {s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resource Management */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-500 fill-blue-500" />
                    Pulse & Credits
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Manage scan frequency and purchasing</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[10px] font-black uppercase text-slate-500">Pulse Interval</span>
                      <select
                        value={frequency} onChange={e => setFrequency(e.target.value as any)}
                        className="bg-slate-800 border-none rounded-lg px-2 py-1 text-[10px] font-black text-blue-400 outline-none"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-Weekly</option>
                      </select>
                    </div>

                    <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-4 mb-6">
                      <p className="text-[10px] font-black uppercase text-blue-400 mb-1">Vault Status</p>
                      <p className="text-2xl font-black text-white">{profile?.manual_scan_credits || 0} <span className="text-xs text-slate-500 font-bold uppercase">Credits</span></p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 mb-2">Buy Manual Scan Credits</h4>
                      {[
                        { amt: 100, price: '$25', desc: 'Starter Pack', link: 100 },
                        { amt: 300, price: '$65', desc: 'Professional', link: 300 },
                        { amt: 1000, price: '$195', desc: 'Enterprise', link: 1000 },
                      ].map(pkg => (
                        <button
                          key={pkg.amt}
                          onClick={() => handlePurchaseCredits(pkg.link)}
                          className="w-full flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800 transition-all group"
                        >
                          <div className="text-left">
                            <p className="text-xs font-black text-white">{pkg.amt} <span className="text-[9px] text-slate-500">Credits</span></p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase">{pkg.desc}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-blue-400">{pkg.price}</span>
                            <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleSave}
                      className="w-full mt-8 bg-blue-600 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                    >
                      Update Configuration
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                  <p className="text-[10px] font-bold text-blue-400/80 leading-relaxed italic">
                    "Intelligence settings apply globally. Changes will be reflected in your next automated pulse."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

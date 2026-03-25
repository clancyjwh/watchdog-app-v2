import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Save, 
  Loader, 
  Plus, 
  Building2, 
  Sparkles, 
  X, 
  Briefcase, 
  Globe, 
  Target, 
  Shield, 
  Info,
  ChevronRight,
  LogOut,
  CreditCard,
  Zap,
  Activity,
  CheckCircle2,
  Layers
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/Sidebar';
import CompanySwitcher from '../components/CompanySwitcher';
import { syncSettingsToWebhook } from '../utils/webhookSync';
import { generateTopicSuggestions } from '../utils/openai';
import { calculatePricing, type PricingConfig, getTierConfig, SubscriptionTier } from '../utils/pricing';

type Topic = {
  id: string;
  topic_name: string;
  is_custom: boolean;
};

type Source = {
  id: string;
  name: string;
  url: string;
  description: string;
  is_core_source?: boolean;
};

type Subscription = {
  id: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  monthly_price: number;
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
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadData();
    }
  }, [profile?.id, currentCompany?.id, authLoading]);

  const loadData = async () => {
    if (!profile?.id || !currentCompany) return;

    try {
      const [topicsRes, subscriptionRes] = await Promise.all([
        supabase.from('topics').select('*').eq('company_id', currentCompany.id),
        supabase.from('subscriptions').select('*').eq('profile_id', profile.id).maybeSingle(),
      ]);

      // Map current company data
      setCompanyName(currentCompany.name || '');
      setIndustry(currentCompany.industry || '');
      setBusinessDescription(currentCompany.description || '');
      setLocationCountry(currentCompany.location_country || '');
      setLocationProvince(currentCompany.location_province || '');
      setLocationCity(currentCompany.location_city || '');
      setResultsPerScan(currentCompany.results_per_scan || 10);
      setAnalysisDepth(currentCompany.analysis_depth || 'standard');

      setTopics(topicsRes.data || []);

      if (subscriptionRes.data) {
        setSubscription(subscriptionRes.data);
        setFrequency(subscriptionRes.data.frequency);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const getCurrentPricing = () => {
    const config: PricingConfig = {
      tier: profile?.subscription_tier || 'basic',
      contentTypeCount: 5, // Default/Placeholder as we removed sources tab
      deliveryMethod: 'dashboard',
      deepAnalysis: analysisDepth === 'deep',
    };
    return calculatePricing(config);
  };

  // Update resultsPerScan when tier changes to match plan defaults
  useEffect(() => {
    if (profile?.subscription_tier) {
      const config = getTierConfig(profile.subscription_tier as SubscriptionTier);
      if (!config.resultsChangeable) {
        setResultsPerScan(config.maxResults);
      }
    }
  }, [profile?.subscription_tier]);

  const handleGetTopicSuggestions = async () => {
    setAiLoading(true);
    try {
      let suggestions = await generateTopicSuggestions(businessDescription, industry, []);
      
      // Fallback if AI/Webhook returns nothing
      if (!suggestions || suggestions.length === 0) {
        const fallbackTopics = await import('../utils/openai').then(m => m.getTopicSuggestions(businessDescription, industry));
        setTopicSuggestions(fallbackTopics);
      } else {
        setTopicSuggestions(suggestions.map(s => s.topic));
      }
    } catch (error) {
      console.error('Error getting topic suggestions:', error);
      // Even deeper fallback
      setTopicSuggestions(['Industry News', 'Regulatory Changes', 'Market Trends', 'Competitor Activity']);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddTopic = async () => {
    if (!newTopic.trim() || !currentCompany?.id) return;

    try {
      const { data } = await supabase
        .from('topics')
        .insert({ 
          company_id: currentCompany.id, 
          profile_id: profile?.id, // Keep for backward compat
          topic_name: newTopic.trim(), 
          is_custom: true 
        })
        .select()
        .single();

      if (data) {
        setTopics([...topics, data]);
        setNewTopic('');
      }
    } catch (error) {
      console.error('Error adding topic:', error);
    }
  };

  const handleRemoveTopic = async (id: string) => {
    try {
      await supabase.from('topics').delete().eq('id', id);
      setTopics(topics.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error removing topic:', error);
    }
  };

  const handleSave = async () => {
    if (!profile?.id || !user || !currentCompany) return;

    setSaving(true);
    try {
      // 1. Update Company (Main source of truth now)
      const { error: companyError } = await supabase
        .from('companies')
        .update({
          name: companyName,
          industry,
          description: businessDescription,
          location_country: locationCountry,
          location_province: locationProvince,
          location_city: locationCity,
          analysis_depth: analysisDepth,
          results_per_scan: resultsPerScan,
        })
        .eq('id', currentCompany.id);

      if (companyError) throw companyError;

      // 2. Update Profile Name for consistency
      await supabase
        .from('profiles')
        .update({ company_name: companyName })
        .eq('id', profile.id);

      // 3. Update Sync/Subscription
      // 3. Update Sync/Subscription (Using upsert to avoid 400/404)
      const pricing = getCurrentPricing();
      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          profile_id: profile.id,
          frequency,
          delivery_method: 'dashboard',
          monthly_price: pricing.monthlyTotal,
          updated_at: new Date().toISOString(),
        }, { 
          onConflict: 'profile_id' 
        });

      if (subError) throw subError;

      // 4. Webhook Sync
      await syncSettingsToWebhook({
        userId: user.id,
        email: user.email || '',
        companyId: currentCompany.id,
        companyName: companyName,
        industry,
        description: businessDescription,
        monitoringGoals: [],
        topics: topics.map(t => t.topic_name),
        sources: [], // Simplified for now
        location: {
          country: locationCountry,
          province: locationProvince,
          city: locationCity,
        },
        context: [],
      });

      await refreshProfile();
      alert('Configuration synchronized successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Activity className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const pricing = getCurrentPricing();

  return (
    <div className="flex bg-slate-50 min-h-screen text-slate-900">
      <Sidebar />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Section */}
        <header className="px-8 py-6 bg-white/80 backdrop-blur-md border-b border-slate-200 z-20 flex items-center justify-between text-left shrink-0">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-indigo-600" />
              Settings
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Your company profile and monitoring settings
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Settings Saved</span>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Activity className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-10 pb-20">
            
            {/* Active Entities Grid */}
            <section className="text-left">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    Your Companies
                  </h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Manage your registered companies</p>
                </div>
                <div className="flex items-center gap-4">
                  <CompanySwitcher />
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all shadow-sm"
                    title="Add New Company"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {companies.map((company: any) => (
                  <button
                    key={company.id}
                    onClick={() => company.id !== currentCompany?.id && switchCompany(company.id)}
                    className={`group p-5 rounded-3xl border-2 transition-all text-left relative overflow-hidden ${
                      company.id === currentCompany?.id
                        ? 'border-indigo-600 bg-white shadow-xl shadow-indigo-100'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    {company.id === currentCompany?.id && (
                      <div className="absolute top-0 right-0 p-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                      </div>
                    )}
                    <h3 className="font-black text-slate-900 text-sm mb-1">{company.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{company.industry}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="text-[9px] font-black text-slate-400 uppercase">Monitoring Active</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Company Profile Component Edit */}
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <div className="mb-6 pb-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Company Profile: {currentCompany?.name}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Company Name</label>
                      <input
                        type="text"
                        value={companyName}
                      onChange={(e: React.ChangeEvent<any>) => setCompanyName(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-bold focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Industry</label>
                      <input
                        type="text"
                        value={industry}
                      onChange={(e: React.ChangeEvent<any>) => setIndustry(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-bold focus:border-indigo-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">About Your Company</label>
                    <textarea
                      value={businessDescription}
                      onChange={(e: React.ChangeEvent<any>) => setBusinessDescription(e.target.value)}
                      rows={5}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 font-medium text-slate-600 focus:border-indigo-500 transition-all outline-none resize-none leading-relaxed text-sm"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 block">Geographic Focus</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={locationCountry}
                      onChange={(e) => setLocationCountry(e.target.value)}
                      className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:border-indigo-500 transition-all outline-none"
                      placeholder="Country"
                    />
                    <input
                      type="text"
                      value={locationProvince}
                      onChange={(e) => setLocationProvince(e.target.value)}
                      className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:border-indigo-500 transition-all outline-none"
                      placeholder="Province"
                    />
                    <input
                      type="text"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold focus:border-indigo-500 transition-all outline-none"
                      placeholder="City"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Strategic Intelligence Channels */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-10 text-left">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    Topics to Monitor
                  </h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Select the topics you want us to monitor</p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTopic()}
                        className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-bold focus:border-indigo-500 transition-all outline-none text-sm"
                        placeholder="e.g. AI in Healthcare..."
                      />
                      <button
                        onClick={handleAddTopic}
                        className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-slate-800 transition-all"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {topics.map((topic) => (
                        <div
                          key={topic.id}
                          className="flex items-center gap-3 pl-4 pr-2 py-2 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-200 transition-all"
                        >
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{topic.topic_name}</span>
                          <button
                            onClick={() => handleRemoveTopic(topic.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommendations */}
                  <div className="pt-8 border-t border-slate-50">
                     <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Suggested Topics</span>
                        <button 
                          onClick={handleGetTopicSuggestions}
                          disabled={aiLoading}
                          className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:underline disabled:opacity-50"
                        >
                          {aiLoading ? 'Analyzing...' : <><Sparkles className="w-3 h-3" /> Refresh Topics</>}
                        </button>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {topicSuggestions.map((suggestion: string) => (
                          <button
                            key={suggestion}
                            onClick={() => setNewTopic(suggestion)}
                            className="px-3 py-1.5 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase transition-all"
                          >
                            + {suggestion}
                          </button>
                        ))}
                     </div>
                  </div>
                </div>
              </div>

              {/* Resource Allocation Sidepanel */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-600 fill-indigo-600" />
                    Your Plan
                  </h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Review your current plan and monitoring frequency</p>
                </div>

                <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                   <div className="relative z-10 text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mb-6">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">{profile?.subscription_tier === 'premium' ? 'Premium Plan' : profile?.subscription_tier === 'enterprise' ? 'Enterprise Plan' : 'Basic Plan'}</p>
                    </div>

                    <div className="flex items-baseline gap-1 mb-10">
                      <span className="text-5xl font-black">${pricing.monthlyTotal}</span>
                      <span className="text-slate-400 font-bold text-base">/mo CAD</span>
                    </div>

                    <div className="space-y-5 mb-10 border-b border-white/5 pb-10">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Scan Frequency</span>
                        <select
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value as any)}
                          className="bg-slate-800 border-none rounded-xl px-3 py-1.5 text-xs font-black text-indigo-300 outline-none cursor-pointer"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Bi-Weekly</option>
                        </select>
                      </div>
                      <div className="flex justify-between items-center group relative">
                         <div className="flex flex-col">
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Results per Scan</span>
                            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tight">
                               {getTierConfig(profile?.subscription_tier as SubscriptionTier).resultsChangeable ? 'Customizable' : 'Fixed by plan'}
                            </span>
                         </div>
                         <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={resultsPerScan}
                              onChange={(e) => setResultsPerScan(parseInt(e.target.value))}
                              disabled={!getTierConfig(profile?.subscription_tier as SubscriptionTier).resultsChangeable}
                              max={getTierConfig(profile?.subscription_tier as SubscriptionTier).maxResults}
                              min={1}
                              className="w-12 bg-slate-800 border-none rounded-xl px-2 py-1.5 text-xs font-black text-indigo-300 text-center outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            />
                            {!getTierConfig(profile?.subscription_tier as SubscriptionTier).resultsChangeable && (
                              <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-800 border border-white/10 px-3 py-2 rounded-xl text-[9px] font-black text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-50">
                                Upgrade to Enterprise to customize
                              </div>
                            )}
                         </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">AI Analysis Level</span>
                        <div className="flex bg-slate-800 p-1 rounded-xl">
                          <button
                            onClick={() => setAnalysisDepth('standard')}
                            className={`px-3 py-1 rounded-lg font-black uppercase text-[9px] transition-all ${analysisDepth === 'standard' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                          >Std</button>
                          <button
                            onClick={() => setAnalysisDepth('deep')}
                            className={`px-3 py-1 rounded-lg font-black uppercase text-[9px] transition-all ${analysisDepth === 'deep' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                          >Deep</button>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{resultsPerScan} AI Scans per cycle</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{analysisDepth === 'deep' ? 'Deep Neural Analysis included' : 'Standard AI Analysis'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Dashboard & Alerts active</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full bg-white text-slate-900 py-4 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                    >
                      {saving ? 'UPDATING...' : 'SAVE SETTINGS'}
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 text-left">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Note
                    </h4>
                    <p className="text-[11px] text-indigo-700/80 font-bold leading-relaxed">
                      Changes trigger a background re-sync. Your monitoring pipeline will update with these new settings on the next scan cycle.
                    </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

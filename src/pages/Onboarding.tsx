import { useState, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getSourceSuggestions } from '../utils/mockAI'; // getTopicSuggestions removed from here
import { getTopicSuggestionsFromAI, getSourceSuggestionsFromAI, SourceSuggestion } from '../utils/perplexity';
import { getTopicSuggestions, generateTopicSuggestions, TopicSuggestion } from '../utils/openai'; // getTopicSuggestions and TopicSuggestion added here
import { generateMockUpdates } from '../utils/mockUpdates';
import { Activity, Check, ChevronRight, ChevronLeft, Zap, AlertCircle, DollarSign, DollarSign as Grant, CreditCard, Shield, Plus, Minus, X, Info, Building2, Briefcase, FileText, Newspaper } from 'lucide-react';
import { formatCurrency, TIER_CONFIGS, SubscriptionTier, getTierConfig, triggerScannerWebhook } from '../utils/pricing';
import Sidebar from '../components/Sidebar';

// Stripe Elements and loadStripe removed in favor of direct Payment Links

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const industries = [
  'Real Estate & Property Management',
  'Legal Services',
  'Technology & Software',
  'Healthcare & Medical',
  'Financial Services',
  'Manufacturing',
  'Retail & E-commerce',
  'Education',
  'Hospitality & Tourism',
  'Construction',
  'Marketing & Advertising',
  'Consulting',
  'Other'
];

const INDUSTRY_OPTIONS = industries;

const CONTENT_TYPES = [
  { id: 'news', label: 'News Articles', icon: Newspaper },
  { id: 'legislation', label: 'Legislation & Regulations', icon: FileText },
  { id: 'grants', label: 'Grant Opportunities', icon: Grant },
  { id: 'government', label: 'Government Updates', icon: Building2 },
  { id: 'competitor', label: 'Competitor News', icon: Briefcase },
];

const MONITORING_GOALS = [
  'Industry news',
  'New rules and regulations',
  'What competitors are doing',
  'New technology',
  'Policy changes',
  'Grants and funding',
  'Economic trends',
  'Customer feedback',
  'Supply chain news',
  'Mergers and acquisitions',
];

export default function Onboarding() {
  const { profile, refreshProfile, user, currentCompany, loading: authLoading, completeSignup } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [finishError, setFinishError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [activeInfoTopic, setActiveInfoTopic] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [businessDescription, setBusinessDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [monitoringGoals, setMonitoringGoals] = useState<string[]>([]);
  
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [suggestedTopics, setSuggestedTopics] = useState<{topic: string, why: string}[]>([]);
  
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(['news', 'press']);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('professional');
  const [frequency, setFrequency] = useState('daily');
  const [resultsPerScan, setResultsPerScan] = useState(5);

  const locationCountry = '';
  const locationProvince = '';
  const locationCity = '';
  const businessContext: string[] = [];
  const selectedSources: any[] = [];

  // Sync resultsPerScan with selected tier
  useEffect(() => {
    const tierConfig = TIER_CONFIGS[selectedTier];
    if (tierConfig && !tierConfig.resultsChangeable) {
      setResultsPerScan(tierConfig.maxResults);
    }
  }, [selectedTier]);

  useEffect(() => {
    completeSignup();
  }, []);

  useEffect(() => {
    if (currentStep === 2 && businessDescription && industry && suggestedTopics.length === 0 && !aiLoading) {
      loadTopicSuggestions();
    }
  }, [currentStep, businessDescription, industry]);

  const loadTopicSuggestions = async () => {
    // Only call once if we already have suggestions
    if (suggestedTopics.length > 0) return;

    setAiLoading(true);
    setAiError('');

    try {
      const suggestions = await generateTopicSuggestions(businessDescription, industry, businessContext);
      if (suggestions && suggestions.length > 0) {
        setSuggestedTopics(suggestions);
      } else {
        // Fallback to local suggestions if webhook returns empty
        const fallbackRaw = getTopicSuggestions(businessDescription, industry);
        setSuggestedTopics(fallbackRaw.map(topic => ({ topic, why: 'Based on your industry and goals' })));
      }
    } catch (error) {
      console.error('Error loading AI topics:', error);
      // Fallback
      const fallbackRaw = getTopicSuggestions(businessDescription, industry);
      setSuggestedTopics(fallbackRaw.map(topic => ({ topic, why: 'Based on your industry and goals' })));
    } finally {
      setAiLoading(false);
    }
  };

  const calculatePricing = () => {
    const tierConfig = getTierConfig(selectedTier);
    const monthly = tierConfig.monthlyPrice;
    return { monthly };
  };

  const pricing = calculatePricing();

  // Load and Save Onboarding State
  useEffect(() => {
    if (authLoading || !user?.id) return;

    const savedState = localStorage.getItem(`watchdog_onboarding_state_${user.id}`);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        console.log('Restoring user-specific onboarding state for:', user.id);
        if (state.currentStep) setCurrentStep(state.currentStep);
        if (state.companyName) setCompanyName(state.companyName);
        if (state.businessDescription) setBusinessDescription(state.businessDescription);
        if (state.industry) setIndustry(state.industry);
        if (state.monitoringGoals) setMonitoringGoals(state.monitoringGoals);
        if (state.selectedTopics) setSelectedTopics(state.selectedTopics);
        if (state.selectedContentTypes) setSelectedContentTypes(state.selectedContentTypes);
        if (state.selectedTier) setSelectedTier(state.selectedTier);
        if (state.frequency) setFrequency(state.frequency);
      } catch (e) {
        console.warn('Failed to parse saved onboarding state', e);
      }
    } else if (!profile?.current_company_id && !profile?.company_name) {
      // If no company data exists in database and no saved state, start fresh
      console.log('New user detected (no company), starting onboarding at Step 1');
      setCurrentStep(1);
      localStorage.removeItem(`watchdog_onboarding_state_${user.id}`); // Clear local state
    } else if (!profile?.current_company_id || !profile?.company_name) {
      // Additional strict check: if either is missing, it's safer to start at Step 1 for a new profile
      console.log('Incomplete profile detected, resetting to Step 1 for consistency');
      setCurrentStep(1);
      localStorage.removeItem(`watchdog_onboarding_state_${user.id}`); // Clear local state
    }
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (!user?.id) return;

    const state = {
      currentStep,
      companyName,
      businessDescription,
      industry,
      monitoringGoals,
      selectedTopics,
      selectedContentTypes,
      selectedTier,
      frequency
    };
    localStorage.setItem(`watchdog_onboarding_state_${user.id}`, JSON.stringify(state));
  }, [currentStep, companyName, businessDescription, industry, monitoringGoals, selectedTopics, selectedContentTypes, selectedTier, frequency, user?.id]);

  const clearOnboardingState = () => {
    if (user?.id) {
      localStorage.removeItem(`watchdog_onboarding_state_${user.id}`);
    }
    localStorage.removeItem('watchdog_onboarding_state');
  };

  useEffect(() => {
    // Check if we just returned from a successful Stripe checkout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true' || urlParams.get('session_id')) {
      setCurrentStep(8);
      // Clean up the URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleNext = async () => {
    console.log('handleNext called, currentStep:', currentStep);

    if (currentStep === 1 && profile && user) {
      setLoading(true);

      const { data: existingCompanies } = await supabase
        .from('companies')
        .select('id')
        .eq('user_id', user.id);

      let companyId: string;

      if (existingCompanies && existingCompanies.length > 0) {
        companyId = existingCompanies[0].id;
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            name: companyName,
            industry: industry,
            description: businessDescription,
            monitoring_goals: monitoringGoals.join(', '),
            location_country: locationCountry,
            location_province: locationProvince,
            location_city: locationCity,
            business_context: businessContext,
          })
          .eq('id', companyId);

        if (updateError) {
          console.error('Error updating company:', updateError);
          setFinishError(`Failed to update company: ${updateError.message}`);
          setLoading(false);
          return;
        }
      } else {
        const { data: newCompany, error: insertError } = await supabase
          .from('companies')
          .insert({
            user_id: user.id,
            name: companyName,
            industry: industry,
            description: businessDescription,
            monitoring_goals: monitoringGoals.join(', '),
            location_country: locationCountry,
            location_province: locationProvince,
            location_city: locationCity,
            business_context: businessContext,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating company:', insertError);
          setFinishError(`Failed to create company: ${insertError.message}`);
          setLoading(false);
          return;
        }
        companyId = newCompany.id;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          company_name: companyName,
          current_company_id: companyId,
        })
        .eq('id', profile.id);

      if (error) {
        console.error('Error updating profile:', error);
        setFinishError(`Failed to update profile: ${error.message}`);
        setLoading(false);
        return;
      }
      await refreshProfile();
      setLoading(false);
      console.log('Triggering AI topics load for step 2');
      loadTopicSuggestions(); // Trigger load immediately
      setCurrentStep(2);
    } else if (currentStep === 3) {
      // Skip Step 4 (Sources) and go straight to Step 5 (Content)
      console.log('Advancing step from 3 to 5 (skipping Sources)');
      setCurrentStep(5);
    } else if (currentStep === 6) {
      // Step 6 (Review) now leads to Step 7 (Payment)
      console.log('Setting step to 7 (Payment) from step 6');
      setCurrentStep(7);
    } else if (currentStep < 8) {
      console.log('Advancing step from', currentStep, 'to', currentStep + 1);
      setCurrentStep((prev: Step) => (prev + 1) as Step);
    }

  };

  const handleBack = () => {
    if (currentStep === 8) {
      setCurrentStep(7);
    } else if (currentStep === 5) {
      // Back from Step 5 goes to Step 3 (skipping Sources)
      setCurrentStep(3);
    } else if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleFinish = async () => {
    if (!profile) {
      setFinishError('Profile not found. Please try logging in again.');
      return;
    }

    if (!currentCompany) {
      setFinishError('Company not found. Please complete step 1 again.');
      return;
    }

    setLoading(true);
    setFinishError('');

    try {
      // 1. Insert topics
      for (const topicName of selectedTopics) {
        await supabase.from('topics').insert({
          profile_id: profile.id,
          company_id: currentCompany.id,
          topic_name: topicName,
          is_custom: !suggestedTopics.some(s => s.topic === topicName),
        });
      }

      // 2. Insert sources
      const sourcesData = [];
      for (const source of selectedSources) {
        const { data, error } = await supabase.from('sources').insert({
          profile_id: profile.id,
          company_id: currentCompany.id,
          name: source.name,
          url: source.url,
          description: source.description,
          rss_feed_url: source.rssFeedUrl || '',
          is_approved: true,
          is_core_source: true,
        }).select();
        if (data) sourcesData.push(data[0]);
      }

      // 3. Give users the credits included in their tier IMMEDIATELY (Fail-safe)
      const tierConfig = getTierConfig(selectedTier);
      await supabase.from('profiles').update({
        manual_scan_credits: tierConfig.monthlyCredits,
      }).eq('id', profile.id);

      // 4. Insert subscription details
      const today = new Date();
      const nextScanDate = new Date();
      nextScanDate.setDate(today.getDate() + 7);
      
      await supabase.from('watchdog_subscribers').upsert({
        profile_id: profile.id,
        company_id: currentCompany.id,
        tier: selectedTier,
        status: 'active',
        monthly_price: tierConfig.monthlyPrice,
        included_credits: tierConfig.monthlyCredits,
        current_period_end: nextScanDate.toISOString(),
      }, { onConflict: 'profile_id' });

      // 5. TRIGGER INITIAL STRATEGIC RESEARCH (100% via Research Engine Webhook)
      try {
        await triggerScannerWebhook(
          user.id, 
          frequency, 
          false, // Not moving to manual, this is the automated logic trigger
          {
            company_name: companyName,
            industry: industry,
            description: businessDescription,
            monitoring_goals: monitoringGoals.join(', '),
            topics: selectedTopics,
            full_name: profile?.full_name,
            email: profile?.email,
            location: `${locationCity}, ${locationProvince}, ${locationCountry}`
          }
        );
      } catch (scanError) {
        console.warn('Initial scan trigger failed (continuing to dashboard):', scanError);
      }

      // 6. Update company settings (Fail-safe in case of schema issues)
      try {
        await supabase.from('companies').update({
          next_scan_due_date: nextScanDate.toISOString(),
          subscription_frequency: frequency,
          last_automated_scan_date: today.toISOString(),
          content_types: selectedContentTypes,
          analysis_depth: 'standard',
          results_per_scan: resultsPerScan,
        }).eq('id', currentCompany.id);
      } catch (companyError) {
        console.warn('Failed to update company settings (non-fatal):', companyError);
      }

      // 7. Complete onboarding
      await supabase.from('profiles').update({
        onboarding_completed: true,
      }).eq('id', profile.id);

      // 8. Secondary Features (Non-blocking / Fail-safe)
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Create Stripe Customer
        fetch(`${supabaseUrl}/functions/v1/create-stripe-customer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
          body: JSON.stringify({ user_id: user?.id, email: profile.email, name: profile.full_name }),
        }).catch(e => console.warn('Stripe customer creation failed:', e));

        // Send Core System Notification
        fetch('https://hook.us2.make.com/adu8oln2b5ghzhy2bmm76flmgh1neao2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: profile.full_name,
            email: profile.email,
            company_name: companyName,
            industry: industry,
            tier: selectedTier,
            timestamp: new Date().toISOString()
          }),
        }).catch(e => console.warn('System notification failed:', e));

        // Trigger Enterprise scanner if needed
        if (selectedTier === 'enterprise' && user) {
          triggerScannerWebhook(user.id, frequency).catch(e => console.warn('Enterprise scanner trigger failed:', e));
        }
      } catch (secondaryError) {
        console.warn('Secondary features caught error:', secondaryError);
      }

      await refreshProfile();
      clearOnboardingState();
      navigate('/dashboard');

    } catch (error) {
      console.error('Error completing onboarding:', error);
      setFinishError(error instanceof Error ? error.message : 'Failed to complete setup. Please try again.');
      setLoading(false);
    }
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const toggleContentType = (typeId: string) => {
    setSelectedContentTypes((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    );
  };

  const addCustomTopic = () => {
    if (customTopic.trim()) {
      setSelectedTopics((prev) => [...prev, customTopic.trim()]);
      setCustomTopic('');
    }
  };




  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return companyName && businessDescription && industry;
      case 2:
        return selectedTopics.length > 0;
      case 3:
        return true;
      case 5:
        return selectedContentTypes.length > 0;
      case 6:
        return true;
      case 7:
        return false;
      default:
        return false;
    }
  };

  useEffect(() => {
    if (currentStep === 7) {
      const timer = setTimeout(() => {
        handlePaymentRedirect();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const handlePaymentRedirect = async () => {
    if (!profile || !user?.email) return;

    setLoading(true);
    setPaymentError('');

    try {
      const tierConfig = TIER_CONFIGS[selectedTier];
      if (!tierConfig?.paymentLink) {
        throw new Error('Payment link not found for selected tier');
      }

      // Redirect to Stripe Payment Link in the SAME tab
      // We pass the profile ID as client_reference_id so the Webhook can identify the user
      const stripeUrl = new URL(tierConfig.paymentLink);
      stripeUrl.searchParams.set('client_reference_id', profile.id);
      stripeUrl.searchParams.set('prefilled_email', user.email);
      // We also pass success_url if supported by the link, but normally it's set in the Dashboard
      
      window.location.href = stripeUrl.toString();
    } catch (error: any) {
      console.error('Payment redirect error:', error);
      setPaymentError(error.message || 'Failed to redirect to payment. Please try again.');
      setLoading(false);
    }
  };

  // handlePaymentSuccess and legacy process-payment removed

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <Sidebar />
      
      <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar relative">
        {/* Background glow effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto w-full px-12 py-16 flex flex-col min-h-full relative z-10">
          {/* Header & Steps */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
                  <Activity className="w-6 h-6 text-white" strokeWidth={3} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight uppercase">Platform <span className="text-blue-500">Deployment</span></h1>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Configuring your intelligence node</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Status: Ready</span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6 px-2">
              {[1, 2, 3, 5, 6, 8].map((step, idx) => {
                const label = ['Company', 'Topics', 'Plan', 'Content', 'Review', 'Finish'][idx];
                const isActive = step === currentStep || (currentStep === 7 && step === 6);
                const isCompleted = step < currentStep || (currentStep > 4 && step === 3);

                return (
                  <div key={step} className="flex-1 flex items-center group">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-2xl font-black text-xs transition-all duration-500 relative ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-600/20'
                          : isCompleted
                          ? 'bg-blue-600/40 text-blue-200'
                          : 'bg-slate-900 border border-slate-800 text-slate-600'
                      }`}
                    >
                      {isCompleted ? <Check className="w-5 h-5" strokeWidth={4} /> : idx + 1}
                      {isActive && (
                        <div className="absolute -bottom-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                      )}
                    </div>
                    {idx < 5 && (
                      <div
                        className={`flex-1 h-0.5 mx-3 transition-all duration-700 rounded-full ${
                          isCompleted ? 'bg-blue-600' : 'bg-slate-800'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-6 text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">
              {['Identity', 'Taxonomy', 'Pricing', 'Sources', 'Review', 'Active'].map((label, idx) => {
                const steps = [1, 2, 3, 5, 6, 8];
                const isActive = steps[idx] === currentStep || (currentStep === 7 && steps[idx] === 6);
                return (
                  <span key={label} className={isActive ? 'text-blue-400' : ''}>{label}</span>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-xl rounded-[40px] border border-slate-800/50 p-12 shadow-2xl relative overflow-hidden">
            {/* Inner background glow */}
            <div className="absolute top-0 right-0 w-[30%] h-[30%] bg-blue-600/5 blur-[80px] rounded-full pointer-events-none" />
          {aiError && (
            <div className="mb-8 p-5 bg-rose-50 border-2 border-rose-100 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest mb-1">Intelligence Error</h4>
                <p className="text-sm text-rose-700 font-medium">{aiError}</p>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4 uppercase italic underline decoration-blue-500/20 underline-offset-8">Business <span className="text-blue-500">Identity</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Let's start by establishing your monitoring baseline. Tell us about your company so our AI can tailor your intelligence feed.
                </p>
              </div>

              <div className="space-y-8 max-w-2xl text-left">
                <div className="group transition-all">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 block group-focus-within:text-blue-500 transition-colors">Registered Company Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                      <Building2 className="h-5 w-5 text-slate-600 group-focus-within:text-blue-500 transition-colors" strokeWidth={3} />
                    </div>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-800/50 rounded-2xl pl-16 pr-6 py-5 font-black text-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all outline-none placeholder:text-slate-700"
                      placeholder="e.g. Acme Corp..."
                    />
                  </div>
                </div>

                <div className="group transition-all">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 block group-focus-within:text-blue-500 transition-colors">Primary Industry Segment</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                      <Briefcase className="h-5 w-5 text-slate-600 group-focus-within:text-blue-500 transition-colors" strokeWidth={3} />
                    </div>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setIndustry(e.target.value)}
                      className="w-full bg-slate-950 border-2 border-slate-800/50 rounded-2xl pl-16 pr-6 py-5 font-black text-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all outline-none placeholder:text-slate-700"
                      placeholder="e.g. Enterprise Software, Legal, Crypto..."
                    />
                  </div>
                </div>

                <div className="p-8 bg-blue-600/5 rounded-3xl border border-blue-600/20">
                  <div className="flex gap-4 items-start">
                    <div className="p-2 bg-blue-600/20 rounded-xl">
                      <Info className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed uppercase tracking-tight">
                      <strong>AI Tip:</strong> These details help us distinguish your company from others and define the relevance of the articles we find.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4 italic underline decoration-blue-500/20 underline-offset-8">Monitoring <span className="text-blue-500">Topics</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  {aiLoading ? 'Our AI is scanning global signals to define your intelligence vectors...' : 'Select the topics you want to monitor or define your own custom vectors.'}
                </p>
              </div>

              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-900/40 rounded-[32px] border-2 border-dashed border-slate-800/50">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600 animate-bounce shadow-2xl shadow-blue-500/20 flex items-center justify-center">
                      <Zap className="w-8 h-8 text-white animate-pulse" />
                    </div>
                  </div>
                  <p className="mt-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">Scanning Global Signals</p>
                </div>
              ) : (
                <div className="space-y-8 text-left">
                  {suggestedTopics && suggestedTopics.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {suggestedTopics.map((item: any) => (
                        <div key={item.topic} className="relative group">
                          <button
                            onClick={() => toggleTopic(item.topic)}
                            className={`w-full p-6 rounded-3xl border-2 text-left transition-all duration-300 ${
                              selectedTopics.includes(item.topic)
                                ? 'border-blue-600 bg-blue-600/5 shadow-2xl shadow-blue-500/10 scale-[1.02]'
                                : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                            }`}
                          >
                            <div className="flex items-center justify-between pr-10">
                               <div>
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">AI Suggested Vector</span>
                                  <span className="font-black text-white text-lg leading-tight block pr-4">{item.topic}</span>
                               </div>
                               {selectedTopics.includes(item.topic) && (
                                 <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Check className="w-4 h-4 text-white" strokeWidth={4} />
                                 </div>
                               )}
                            </div>
                          </button>
                          
                          <button
                            onClick={(e: any) => {
                              e.stopPropagation();
                              setActiveInfoTopic(activeInfoTopic === item.topic ? null : item.topic);
                            }}
                            className="absolute top-6 right-6 p-2.5 bg-slate-950 rounded-xl text-slate-600 hover:text-blue-500 transition-all shadow-sm border border-slate-800 hover:border-blue-500/50"
                            title="Why this topic?"
                          >
                            <Info className="w-4 h-4" />
                          </button>

                          {activeInfoTopic === item.topic && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-4 p-6 bg-slate-900 text-white rounded-[24px] shadow-2xl animate-in fade-in zoom-in-95 border border-white/10 ring-8 ring-blue-500/5">
                              <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Why we suggest this</span>
                                {item.priority && (
                                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full border border-blue-500/30">
                                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                                    <span className="text-[10px] text-blue-100 font-black uppercase tracking-wider">
                                       Priority: {item.priority}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-slate-300 leading-relaxed font-bold italic">
                                "{item.why}"
                              </p>
                              <div className="mt-5 pt-5 border-t border-white/10">
                                 <button 
                                   onClick={() => setActiveInfoTopic(null)}
                                   className="w-full py-2.5 text-[10px] font-black text-white uppercase tracking-[0.2em] bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                                 >
                                   Close
                                 </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-slate-950 rounded-[32px] border-2 border-dashed border-slate-800">
                      <p className="text-slate-600 font-black mb-6 uppercase tracking-[0.2em] text-[10px]">No topics Suggested yet</p>
                      <button
                        onClick={loadTopicSuggestions}
                        className="px-10 py-4 bg-slate-900 border-2 border-slate-800 text-white rounded-2xl hover:border-blue-600 transition-all font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/5"
                      >
                        Refresh Topics
                      </button>
                    </div>
                  )}

                  <div className="pt-6 border-t border-slate-800/50">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 block">Add custom intelligence vector</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={customTopic}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomTopic(e.target.value)}
                        onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addCustomTopic()}
                        className="flex-1 bg-slate-950 border-2 border-slate-800 rounded-2xl px-6 py-4 font-black text-white focus:border-blue-600 transition-all outline-none"
                        placeholder="e.g. Specific Regulatory Change..."
                      />
                      <button
                        onClick={addCustomTopic}
                        className="p-4 bg-white text-slate-900 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-xl shadow-white/5"
                      >
                        <Plus className="w-6 h-6" strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {selectedTopics.filter((t: string) => !suggestedTopics.some((s: any) => s.topic === t)).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedTopics
                        .filter((t: string) => !suggestedTopics.some((s: any) => s.topic === t))
                        .map((topic: string) => (
                          <span
                            key={topic}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                          >
                            {topic}
                            <button onClick={() => toggleTopic(topic)} className="hover:text-blue-400">
                              <X className="w-4 h-4" strokeWidth={3} />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4 italic underline decoration-blue-500/20 underline-offset-8">Choose <span className="text-blue-500">Your Plan</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Select an intelligence tier to start monitoring your industry vectors with deep AI analysis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.values(TIER_CONFIGS).map((tier: any) => (
                  <button
                    key={tier.tier}
                    onClick={() => setSelectedTier(tier.tier)}
                    className={`relative flex flex-col p-8 rounded-[32px] border-2 text-left transition-all duration-300 ${
                      selectedTier === tier.tier
                        ? 'border-blue-600 bg-blue-600/5 shadow-2xl shadow-blue-500/10 scale-[1.05] z-10'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {tier.tier === 'premium' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-blue-500/50">
                        Most Popular
                      </div>
                    )}
                    <div className="mb-8">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{tier.name} Tier</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-white">
                          {formatCurrency(tier.monthlyPrice)}
                        </span>
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-widest">/mo</span>
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8 flex-1">
                      {tier.features.slice(0, 5).map((feature: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className={`mt-0.5 p-1 rounded-md ${
                            selectedTier === tier.tier ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-800 text-slate-600'
                          }`}>
                            <Check className="w-3 h-3" strokeWidth={4} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-400 leading-tight uppercase tracking-tight">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-center transition-all ${
                      selectedTier === tier.tier ? 'bg-white text-slate-900 shadow-xl shadow-white/10' : 'bg-slate-800/50 text-slate-500 border border-slate-700/30'
                    }`}>
                      {selectedTier === tier.tier ? 'Activated' : 'Select Plan'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}


          {currentStep === 5 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4">Source <span className="text-blue-500 underline decoration-blue-500/20 underline-offset-8">Types</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Select the types of content you want us to monitor across the web for the most relevant updates.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-5 text-left">
                {CONTENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedContentTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      onClick={() => toggleContentType(type.id)}
                      className={`group p-6 rounded-[24px] border-2 text-left transition-all duration-300 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600/5 shadow-2xl shadow-blue-500/10'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl transition-all duration-300 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-slate-800 text-slate-500 group-hover:text-slate-400'
                        }`}>
                          <Icon className="w-6 h-6" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] font-black uppercase tracking-widest ${
                              isSelected ? 'text-white' : 'text-slate-500'
                            }`}>{type.label}</span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                 <Check className="w-3 h-3 text-white" strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-500 leading-tight">Custom monitoring</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl text-left">
                <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4 uppercase italic underline decoration-blue-500/20 underline-offset-8">Review <span className="text-blue-500">Your Setup</span></h2>
                <p className="text-slate-400 font-bold leading-relaxed pr-8">
                  Review your business profile and monitoring settings before we start your baseline intelligence sweep.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left w-full h-[500px]">
                {/* Scrollable Configuration Column */}
                <div className="bg-slate-900/40 rounded-[32px] border border-slate-800/50 p-6 flex flex-col shadow-inner h-full">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex-shrink-0">Configuration Values</h3>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-8 custom-scrollbar">
                    
                    {/* Business Profile */}
                    <div className="space-y-3">
                       <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] block mb-2">Target Profile</span>
                       <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Entity</span>
                          <span className="text-xs font-black text-white">{companyName || 'Not Set'}</span>
                       </div>
                       <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Vector</span>
                          <span className="text-xs font-black text-white">{industry || 'Not Set'}</span>
                       </div>
                    </div>

                    {/* Monitored Topics */}
                    <div>
                      <div className="flex justify-between flex-end mb-2">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">Signal Filters</span>
                        <span className="text-[9px] font-black text-slate-600 bg-slate-950 px-2 py-0.5 rounded tracking-widest">{selectedTopics.length} Active</span>
                      </div>
                      <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                        {selectedTopics.length > 0 ? selectedTopics.map((topic) => (
                          <span key={topic} className="px-2 py-1 bg-slate-800/50 text-white border border-slate-700 rounded text-[9px] font-bold uppercase tracking-tight">
                            {topic}
                          </span>
                        )) : <span className="text-xs text-slate-600 italic">No topics selected</span>}
                      </div>
                    </div>

                    {/* Content Types */}
                    <div>
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] block mb-2">Source Integrity</span>
                      <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                        {selectedContentTypes.length > 0 ? selectedContentTypes.map((typeId) => {
                          const type = CONTENT_TYPES.find((t) => t.id === typeId);
                          return (
                            <span key={typeId} className="px-2 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest">
                              {type && <type.icon className="w-3 h-3" />}
                              {type?.label}
                            </span>
                          );
                        }) : <span className="text-xs text-slate-600 italic">No sources selected</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fixed Plan Overview Column */}
                <div className="bg-slate-950 rounded-[40px] p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group border border-slate-800 h-full">
                  <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-blue-500/5 blur-[80px] rounded-full pointer-events-none transition-transform duration-1000 group-hover:scale-110" />
                  
                  <div className="relative z-10 flex-shrink-0">
                    <div className="inline-flex items-center gap-2 mb-8">
                       <div className="w-2 h-2 rounded bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
                       <span className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em]">Network Node Status</span>
                    </div>
                    
                    <h3 className="text-4xl font-black text-white tracking-tight mb-2 uppercase italic">{getTierConfig(selectedTier).name} <span className="text-blue-500">Tier</span></h3>
                    <p className="text-sm font-bold text-slate-400 tracking-tight leading-relaxed mb-6">Fully operational {getTierConfig(selectedTier).features[0].toLowerCase()} optimized for advanced analytics.</p>
                    
                    <div className="space-y-4">
                      {getTierConfig(selectedTier).features.slice(1, 4).map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded border border-slate-800 bg-slate-900 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-blue-500" strokeWidth={4} />
                          </div>
                          <span className="text-xs font-bold text-slate-300 tracking-tight leading-tight">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="relative z-10 mt-auto pt-6 border-t border-slate-800/50 flex-shrink-0">
                     <div className="flex justify-between items-end">
                        <div>
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Power Allocation</span>
                           <div className="text-sm font-black text-blue-400 flex items-center gap-2">
                             <Zap className="w-4 h-4" />
                             {getTierConfig(selectedTier).monthlyCredits} CPU / MO
                           </div>
                        </div>
                        <div className="text-right">
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Network Access</span>
                           <div className="flex items-baseline gap-1">
                             <span className="text-4xl font-black text-white tracking-tighter leading-none">${pricing.monthly.toFixed(0)}</span>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">/ Mo</span>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}


          {currentStep === 7 && (
            <div className="flex flex-col items-center justify-center py-24 flex-1">
              <div className="relative mb-12">
                <div className="w-32 h-32 rounded-[40px] bg-blue-600/10 border-2 border-dashed border-blue-600/30 flex items-center justify-center animate-[spin_10s_linear_infinite]">
                  <CreditCard className="w-12 h-12 text-blue-500 -rotate-45" />
                </div>
                <div className="absolute inset-0 w-32 h-32 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-blue-600 animate-ping" />
                </div>
              </div>
              <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-6 italic underline decoration-blue-500/20 underline-offset-8">Secure <span className="text-blue-500">Checkout</span></h2>
              <p className="text-slate-400 font-bold leading-relaxed max-w-md text-center uppercase tracking-widest text-xs">
                Establishing subscription tunnel. Redirecting to our secure payment gateway in <span className="text-blue-500">3 seconds...</span>
              </p>
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-12 flex-1 flex flex-col items-center justify-center text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full animate-pulse" />
                <div className="relative z-10 w-24 h-24 rounded-[32px] bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl shadow-blue-500/20">
                   <Activity className="w-10 h-10 text-blue-400" strokeWidth={3} />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-blue-600 border-4 border-[#020617] flex items-center justify-center shadow-lg">
                   <Check className="w-5 h-5 text-white" strokeWidth={4} />
                </div>
              </div>

              <div className="max-w-md space-y-4">
                <h2 className="text-5xl font-black text-white tracking-tight leading-none uppercase italic">Setup <span className="text-blue-500">Complete</span></h2>
                <p className="text-slate-400 font-bold text-lg leading-relaxed px-4">
                  Intelligence node operational. We're starting your first scan now and will notify you of any findings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
                <div className="p-8 bg-slate-900/40 rounded-[32px] border border-slate-800 flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Vectors</span>
                  <span className="text-3xl font-black text-white">{selectedTopics.length}</span>
                </div>

                <div className="p-8 bg-slate-900/40 rounded-[32px] border border-slate-800 flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Credits</span>
                  <span className="text-3xl font-black text-blue-500">{getTierConfig(selectedTier).monthlyCredits}</span>
                </div>

                <div className="p-8 bg-slate-900/40 rounded-[32px] border border-slate-800 flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Status</span>
                  <span className="text-3xl font-black text-white uppercase">{selectedTier.charAt(0)}</span>
                </div>
              </div>

              <div className="w-full max-w-lg p-8 bg-blue-600/5 rounded-[32px] text-left border border-blue-500/20 shadow-2xl">
                 <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4">Post-Deployment Protocol</h4>
                 <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                       <div className="p-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Zap className="w-3 h-3" strokeWidth={3} />
                       </div>
                       <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-tight">System will initiate baseline intelligence sweep immediately.</p>
                    </div>
                    <div className="flex gap-4 items-start">
                       <div className="p-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Zap className="w-3 h-3" strokeWidth={3} />
                       </div>
                       <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-tight">Primary signals will propagate to your hub within 60 seconds.</p>
                    </div>
                 </div>
              </div>
            </div>
          )}

        </div>

        {finishError && (
          <div className="mt-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-3xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest mb-1">Configuration Lock Error</h4>
              <p className="text-sm text-rose-700 font-bold leading-relaxed">{finishError}</p>
            </div>
            <button
              onClick={() => setFinishError('')}
              className="p-2 text-rose-400 hover:text-rose-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex justify-between mt-12 mb-20 px-8 py-10 bg-slate-900/40 rounded-[32px] border border-slate-800/50 backdrop-blur-md">
          <button
            onClick={handleBack}
            disabled={currentStep === 1 || loading}
            className="group flex items-center gap-3 px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-all disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" strokeWidth={4} />
            BACKBOLT
          </button>

          <div className="flex items-center gap-10">
            <div className="hidden sm:flex flex-col items-end">
               <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1">Status Report</span>
               <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-black text-white tracking-[0.2em]">
                    PHASE_{currentStep}_INITIATED
                  </span>
               </div>
            </div>
            
            {currentStep === 8 ? (
              <button
                onClick={handleFinish}
                disabled={loading}
                className="group flex items-center gap-5 px-12 py-5 bg-white text-slate-900 rounded-[24px] font-black text-[13px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-500 disabled:opacity-50 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                <span className="relative z-10 flex items-center gap-3">
                  {loading ? 'CALIBRATING...' : 'ESTABLISH WATCHDOG'}
                  <Zap className="w-5 h-5 group-hover:animate-bounce" />
                </span>
              </button>
            ) : currentStep < 7 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className="group flex items-center gap-5 px-12 py-5 bg-white text-slate-900 rounded-[24px] font-black text-[13px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white hover:shadow-[0_0_50px_rgba(59,130,246,0.2)] transition-all duration-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
              >
                {loading ? 'PROCESSING...' : currentStep === 6 ? 'DEPLOY' : 'NEXT_LEVEL'}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-2 transition-transform shadow-blue-500/20" strokeWidth={4} />
              </button>
            ) : null}
          </div>
          </div>
        </div>
      </div>
    </div>
  ); 
}

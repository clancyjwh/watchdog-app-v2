import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getSourceSuggestions } from '../utils/mockAI'; // getTopicSuggestions removed from here
import { getTopicSuggestionsFromAI, getSourceSuggestionsFromAI, SourceSuggestion } from '../utils/perplexity';
import { getTopicSuggestions, generateTopicSuggestions, TopicSuggestion } from '../utils/openai'; // getTopicSuggestions and TopicSuggestion added here
import { generateMockUpdates } from '../utils/mockUpdates';
import { Activity, Check, ChevronRight, ChevronLeft, Plus, X, DollarSign, Newspaper, FileText, DollarSign as Grant, BarChart, Megaphone, Building2, Briefcase, AlertCircle, Zap, Info } from 'lucide-react'; // Info added here
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripeCardInput from '../components/StripeCardInput';
import { formatCurrency, TIER_CONFIGS, SubscriptionTier, getTierConfig, triggerScannerWebhook, getNextDeliveryDate } from '../utils/pricing';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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

  const [locationCountry, setLocationCountry] = useState('');
  const [locationProvince, setLocationProvince] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [businessContext, setBusinessContext] = useState<string[]>([]);

  const [suggestedTopics, setSuggestedTopics] = useState<TopicSuggestion[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  // activeInfoTopic removed here as it was moved up

  const [suggestedSources, setSuggestedSources] = useState<SourceSuggestion[]>([]);
  const [selectedSources, setSelectedSources] = useState<SourceSuggestion[]>([]);
  const [customSource, setCustomSource] = useState({ name: '', url: '', description: '', category: '', rssFeedUrl: '' });

  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(['news', 'legislation', 'government']);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('premium');

  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly' | 'daily'>('biweekly');
  const [analysisDepth, setAnalysisDepth] = useState<'standard' | 'deep'>('standard');
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [resultsPerScan, setResultsPerScan] = useState(5);
  const [requestingMoreSources, setRequestingMoreSources] = useState(false);

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
    const savedState = localStorage.getItem('watchdog_onboarding_state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
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
    }
  }, []);

  useEffect(() => {
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
    localStorage.setItem('watchdog_onboarding_state', JSON.stringify(state));
  }, [currentStep, companyName, businessDescription, industry, monitoringGoals, selectedTopics, selectedContentTypes, selectedTier, frequency]);

  const clearOnboardingState = () => {
    localStorage.removeItem('watchdog_onboarding_state');
  };

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
      setCurrentStep((prev) => (prev + 1) as Step);
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
      // Insert topics
      for (const topicName of selectedTopics) {
        const { error } = await supabase.from('topics').insert({
          profile_id: profile.id,
          company_id: currentCompany.id,
          topic_name: topicName,
          is_custom: !suggestedTopics.some(s => s.topic === topicName),
        });
        if (error) throw new Error(`Failed to save topics: ${error.message}`);
      }

      // Insert sources
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
        if (error) throw new Error(`Failed to save sources: ${error.message}`);
        if (data) sourcesData.push(data[0]);
      }

      // Insert subscription with actual pricing and 7-day schedule
      const tierConfig = getTierConfig(selectedTier);
      const today = new Date();
      const nextScanDate = new Date();
      nextScanDate.setDate(today.getDate() + 7);
      
      const { error: subscriptionError } = await supabase.from('watchdog_subscribers').insert({
        profile_id: profile.id,
        company_id: currentCompany.id,
        tier: selectedTier,
        status: 'active',
        monthly_price: tierConfig.monthlyPrice,
        included_credits: tierConfig.monthlyCredits,
        current_period_end: nextScanDate.toISOString(),
      });
      if (subscriptionError) throw new Error(`Failed to save subscription details: ${subscriptionError.message}`);

      // Update companies table with next scan date and automated scan tracking
      await supabase.from('companies').update({
        next_scan_due_date: nextScanDate.toISOString(),
        subscription_frequency: frequency,
        last_automated_scan_date: today.toISOString(),
      }).eq('id', currentCompany.id);

      // Give users the credits included in their tier
      const { error: creditsError } = await supabase
        .from('profiles')
        .update({
          manual_scan_credits: tierConfig.monthlyCredits,
        })
        .eq('id', profile.id);

      if (creditsError) console.warn('Failed to set initial credits:', creditsError);

      // Update profile with default values
      // Update company with final settings
      const { error: companyUpdateError } = await supabase
        .from('companies')
        .update({
          content_types: selectedContentTypes,
          analysis_depth: 'standard',
          results_per_scan: 5,
        })
        .eq('id', currentCompany.id);
      
      if (companyUpdateError) throw new Error(`Failed to update company: ${companyUpdateError.message}`);

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
        })
        .eq('id', profile.id);
      if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);

      // Generate mock updates (don't block on this)
      try {
        await generateMockUpdates(
          profile.id,
          businessDescription,
          industry,
          sourcesData,
          selectedTopics,
          selectedContentTypes
        );
      } catch (mockError) {
        console.warn('Failed to generate mock updates:', mockError);
      }

      // Trigger immediate scan for all new signups
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const today = new Date().toISOString().split('T')[0];
        const dateFromObj = new Date();
        dateFromObj.setDate(dateFromObj.getDate() - 7);
        const dateFrom = dateFromObj.toISOString().split('T')[0];

        // Fetch initial updates using Perplexity
        const perplexityResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-perplexity-updates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            topics: selectedTopics,
            sources: sourcesData.map(s => ({
              name: s.name,
              url: s.url,
              rss_feed_url: s.rss_feed_url
            })),
            contentTypes: selectedContentTypes,
            businessDescription: businessDescription,
            industry: industry,
            monitoringGoals: monitoringGoals.join(', '),
            location: [locationCity, locationProvince, locationCountry].filter(Boolean).join(', '),
            businessContext: businessContext,
            dateFrom,
            dateTo: today,
            scanOptions: {
              depth: 'standard',
              priority: 'balanced',
              maxArticles: 5,
              timeRange: '7days'
            }
          }),
        });

        if (!perplexityResponse.ok) {
          const errorData = await perplexityResponse.json().catch(() => ({}));
          throw new Error(errorData.details || errorData.error || `Initial scan search failed (${perplexityResponse.status})`);
        }

        const perplexityData = await perplexityResponse.json();
        const allUpdates = perplexityData.updates || [];

        // Monitor monitored sources if any
        if (sourcesData.length > 0) {
          const monitorResponse = await fetch(`${supabaseUrl}/functions/v1/monitor-tracked-sources`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              profileId: profile.id,
            }),
          });

          if (monitorResponse.ok) {
            const monitorData = await monitorResponse.json();
            if (monitorData.updates && monitorData.updates.length > 0) {
              allUpdates.push(...monitorData.updates);
            }
          }
        }

        // Save all updates to the database
        if (allUpdates.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await fetch(`${supabaseUrl}/functions/v1/receive-updates`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                userId: user.id,
                updates: allUpdates,
                isManualScan: false
              }),
            });
          }
        }

        // Trigger background research generation (don't wait)
        const researchTopics = selectedTopics.map(t => ({ topic: t, tags: [] }));

        fetch(`${supabaseUrl}/functions/v1/generate-background-research`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            profileId: profile.id,
            topics: researchTopics,
            depth: 'standard',
          }),
        }).catch(err => console.warn('Background research failed:', err));
      } catch (scanError) {
        console.warn('Failed to run initial scan:', scanError);
      }

      // Create Stripe customer after onboarding is complete
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const customerResponse = await fetch(`${supabaseUrl}/functions/v1/create-stripe-customer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            user_id: user?.id,
            email: profile.email,
            name: profile.full_name,
          }),
        });

        const customerData = await customerResponse.json();
        if (!customerData.success && !customerData.skipped) {
          console.warn('Failed to create Stripe customer:', customerData.error);
        } else if (customerData.success) {
          console.log('Stripe customer created successfully');
        }
      } catch (stripeError) {
        console.warn('Failed to create Stripe customer (non-fatal):', stripeError);
      }

      // Send webhook notification to Make.com
      try {
        await fetch('https://hook.us2.make.com/adu8oln2b5ghzhy2bmm76flmgh1neao2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: profile.full_name,
            email: profile.email,
            company_name: companyName,
            industry: industry,
            description: businessDescription,
            monitoring_goals: monitoringGoals.join(', '),
            location: [locationCity, locationProvince, locationCountry].filter(Boolean).join(', '),
            tier: selectedTier,
            sources_count: selectedSources.length,
            topics_count: selectedTopics.length,
            timestamp: new Date().toISOString()
          }),
        });
      } catch (webhookError) {
        console.warn('Failed to send webhook notification (non-fatal):', webhookError);
      }

      await refreshProfile();
      // Trigger Enterprise scanner if needed
      if (selectedTier === 'enterprise') {
        await triggerScannerWebhook(user.id, frequency);
      }

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

  const addCustomTopic = () => {
    if (customTopic.trim()) {
      setSelectedTopics((prev) => [...prev, customTopic.trim()]);
      setCustomTopic('');
    }
  };




  const toggleContentType = (typeId: string) => {
    setSelectedContentTypes((prev) =>
      prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId]
    );
  };

  const addCompetitor = () => {
    if (competitorInput.trim()) {
      setCompetitors((prev) => [...prev, competitorInput.trim()]);
      setCompetitorInput('');
    }
  };

  const removeCompetitor = (index: number) => {
    setCompetitors((prev) => prev.filter((_, i) => i !== index));
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      setKeywords((prev) => [...prev, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== index));
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

  const handlePaymentSuccess = async (paymentMethodId: string) => {
    if (!profile || !user?.email) return;

    setLoading(true);
    setPaymentError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const pricing = calculatePricing();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'subscribe',
            payment_method_id: paymentMethodId,
            profile_id: profile.id,
            user_email: user.email,
            tier: selectedTier,
            billing_period: 'monthly',
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        await handleFinish();
      } else {
        throw new Error(data.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  const handlePaymentError = (error: string) => {
    setPaymentError(error);
  };

  if ((authLoading && !profile) || (!authLoading && (!profile || !user))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                <Activity className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">WatchDog<span className="text-indigo-600">AI</span></h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Intelligence Setup</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-indigo-600 shadow-lg shadow-indigo-500/50 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Intelligence Online</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2" />
            <div 
              className="absolute top-1/2 left-0 h-0.5 bg-indigo-600 -translate-y-1/2 transition-all duration-500 ease-out" 
              style={{ width: `${((currentStep > 4 ? currentStep - 1 : currentStep) - 1) / 5 * 100}%` }}
            />
            <div className="relative flex justify-between">
              {[1, 2, 3, 5, 6, 8].map((step, idx) => {
                const label = ['Company', 'Topics', 'Plan', 'Summary', 'Review', 'Finish'][idx];
                const isActive = step === currentStep || (currentStep === 7 && step === 6);
                const isCompleted = step < currentStep || (currentStep > 4 && step === 3);

                return (
                  <div key={step} className="flex flex-col items-center group">
                    <div
                      className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-2xl font-black text-xs transition-all duration-300 border-4 ${
                        isActive
                          ? 'bg-slate-900 text-white border-white shadow-xl shadow-slate-200 scale-110'
                          : isCompleted
                          ? 'bg-indigo-600 text-white border-white shadow-lg shadow-indigo-100'
                          : 'bg-white text-slate-300 border-slate-50'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : idx + 1}
                    </div>
                    <span className={`absolute -bottom-7 text-[9px] font-black uppercase tracking-tighter whitespace-nowrap transition-colors ${
                      isActive ? 'text-slate-900' : 'text-slate-400'
                    }`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 p-10 min-h-[500px] border border-slate-100 flex flex-col">
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
              <div className="max-w-xl">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">Company <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Details</span></h2>
                <p className="text-slate-500 font-bold leading-relaxed pr-8">
                  Tell us about your company so we can find the most relevant updates for you.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 block">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-300"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 block">Industry</label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-black text-slate-900 focus:border-indigo-500 transition-all outline-none"
                    >
                      <option value="">Select Industry</option>
                      {INDUSTRY_OPTIONS.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 block">Company Description</label>
                    <textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      rows={5}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-600 focus:border-indigo-500 transition-all outline-none resize-none leading-relaxed text-sm placeholder:text-slate-300"
                      placeholder="What does your company do?"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 block">What are you looking for?</label>
                  <div className="grid grid-cols-1 gap-3">
                    {MONITORING_GOALS.slice(0, 6).map((goal) => (
                      <button
                        key={goal}
                        onClick={() => {
                          if (monitoringGoals.includes(goal)) {
                            setMonitoringGoals(monitoringGoals.filter(g => g !== goal));
                          } else {
                            setMonitoringGoals([...monitoringGoals, goal]);
                          }
                        }}
                        className={`group flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                          monitoringGoals.includes(goal)
                            ? 'border-indigo-600 bg-white shadow-xl shadow-indigo-100'
                            : 'border-slate-50 bg-slate-50 hover:border-slate-100'
                        }`}
                      >
                        <span className={`text-xs font-black uppercase tracking-wider transition-colors ${
                          monitoringGoals.includes(goal) ? 'text-slate-900' : 'text-slate-500'
                        }`}>{goal}</span>
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                          monitoringGoals.includes(goal) ? 'bg-indigo-600' : 'bg-slate-200 group-hover:bg-slate-300'
                        }`}>
                          {monitoringGoals.includes(goal) && <Check className="w-3 h-3 text-white" strokeWidth={4} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Geographic Focus (optional)</label>
                <p className="text-xs text-gray-500 mb-3">Help AI find geographically relevant sources and filter updates by location</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Country/Region</label>
                    <input
                      type="text"
                      value={locationCountry}
                      onChange={(e) => setLocationCountry(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g., Canada"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Province/State</label>
                    <input
                      type="text"
                      value={locationProvince}
                      onChange={(e) => setLocationProvince(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g., British Columbia"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">City/Local</label>
                    <input
                      type="text"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g., Vancouver"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">Business Context (optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'non-profit', label: 'Non-profit organization' },
                    { id: 'government', label: 'Government/Public sector' },
                    { id: 'b2b', label: 'B2B (business to business)' },
                    { id: 'b2c', label: 'B2C (business to consumer)' },
                    { id: 'startup', label: 'Startup/Early stage' },
                    { id: 'enterprise', label: 'Enterprise/Large organization' },
                    { id: 'regulated', label: 'Regulated industry' },
                  ].map((context) => (
                    <label
                      key={context.id}
                      className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={businessContext.includes(context.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBusinessContext([...businessContext, context.id]);
                          } else {
                            setBusinessContext(businessContext.filter(c => c !== context.id));
                          }
                        }}
                        className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{context.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> The more details you provide, the better our custom AI can recommend relevant topics and content for your needs.
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">Monitoring <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Topics</span></h2>
                <p className="text-slate-500 font-bold leading-relaxed pr-8">
                  {aiLoading ? 'Our AI is finding the most relevant sources and topics for your business...' : 'Select the topics you want to monitor or add your own.'}
                </p>
              </div>

              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 animate-bounce shadow-2xl shadow-indigo-200 flex items-center justify-center">
                      <Zap className="w-8 h-8 text-white animate-pulse" />
                    </div>
                  </div>
                  <p className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Finding Relevant Topics</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {suggestedTopics && suggestedTopics.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {suggestedTopics.map((item) => (
                        <div key={item.topic} className="relative group">
                          <button
                            onClick={() => toggleTopic(item.topic)}
                            className={`w-full p-6 rounded-3xl border-2 text-left transition-all duration-300 ${
                              selectedTopics.includes(item.topic)
                                ? 'border-indigo-600 bg-white shadow-2xl shadow-indigo-100 scale-[1.02]'
                                : 'border-slate-50 bg-slate-50 hover:border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between pr-10">
                               <div>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">AI Suggested Vector</span>
                                  <span className="font-black text-slate-900 text-lg leading-tight block pr-4">{item.topic}</span>
                               </div>
                               {selectedTopics.includes(item.topic) && (
                                 <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <Check className="w-4 h-4 text-white" strokeWidth={4} />
                                 </div>
                               )}
                            </div>
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveInfoTopic(activeInfoTopic === item.topic ? null : item.topic);
                            }}
                            className="absolute top-6 right-6 p-2.5 bg-white rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm border border-slate-100 hover:border-indigo-100"
                            title="Why this topic?"
                          >
                            <Info className="w-4 h-4" />
                          </button>

                          {activeInfoTopic === item.topic && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-4 p-6 bg-slate-900 text-white rounded-[24px] shadow-2xl animate-in fade-in zoom-in-95 border border-white/10 ring-8 ring-indigo-500/5">
                              <div className="flex justify-between items-start mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Why we suggest this</span>
                                {item.priority && (
                                  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="text-[10px] text-indigo-100 font-black uppercase tracking-wider">
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
                    <div className="text-center py-20 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                      <p className="text-slate-400 font-black mb-6 uppercase tracking-[0.2em] text-[10px]">No topics Suggested yet</p>
                      <button
                        onClick={loadTopicSuggestions}
                        className="px-10 py-4 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl hover:border-indigo-500 transition-all font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200/50"
                      >
                        Refresh Topics
                      </button>
                    </div>
                  )}

                  <div className="pt-6 border-t border-slate-100">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Add your own topic</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCustomTopic()}
                        className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black text-slate-900 focus:border-indigo-500 transition-all outline-none"
                        placeholder="e.g. Specific Regulatory Change..."
                      />
                      <button
                        onClick={addCustomTopic}
                        className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200"
                      >
                        <Plus className="w-6 h-6" strokeWidth={3} />
                      </button>
                    </div>
                  </div>

                  {selectedTopics.filter((t) => !suggestedTopics.some(s => s.topic === t)).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedTopics
                        .filter((t) => !suggestedTopics.some(s => s.topic === t))
                        .map((topic) => (
                          <span
                            key={topic}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                          >
                            {topic}
                            <button onClick={() => toggleTopic(topic)} className="hover:text-indigo-400">
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
              <div className="max-w-xl">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">Choose <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Your Plan</span></h2>
                <p className="text-slate-500 font-bold leading-relaxed pr-8">
                  Choose a plan to start monitoring your industry and receive deep AI analysis.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.values(TIER_CONFIGS).map((tier) => (
                  <button
                    key={tier.tier}
                    onClick={() => setSelectedTier(tier.tier)}
                    className={`relative flex flex-col p-8 rounded-[32px] border-2 text-left transition-all duration-300 ${
                      selectedTier === tier.tier
                        ? 'border-indigo-600 bg-white shadow-2xl shadow-indigo-100 scale-[1.05] z-10'
                        : 'border-slate-50 bg-slate-50 hover:border-slate-100 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {tier.tier === 'premium' && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-200">
                        Most Popular
                      </div>
                    )}
                    <div className="mb-8">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{tier.name} Tier</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-slate-900">
                          {formatCurrency(tier.monthlyPrice)}
                        </span>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">/mo</span>
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8 flex-1">
                      {tier.features.slice(0, 5).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className={`mt-0.5 p-1 rounded-md ${
                            selectedTier === tier.tier ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <Check className="w-3 h-3" strokeWidth={4} />
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 leading-tight uppercase tracking-tight">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-center transition-all ${
                      selectedTier === tier.tier ? 'bg-slate-900 text-white' : 'bg-white border-2 border-slate-100 text-slate-400'
                    }`}>
                      {selectedTier === tier.tier ? 'Activated' : 'Select Plan'}
                    </div>
                  </button>
                ))}
              </div>

              <div className="bg-slate-900 rounded-3xl p-8 flex items-center justify-between border border-white/10 shadow-2xl invisible opacity-0 h-0 w-0 overflow-hidden">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <Info className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-widest mb-1">Monitoring System</h4>
                    <p className="text-slate-400 text-xs font-bold leading-relaxed">
                      All plans include automated web monitoring. You can adjust your settings anytime after setup.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}


          {currentStep === 5 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">Source <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Types</span></h2>
                <p className="text-slate-500 font-bold leading-relaxed pr-8">
                  Select the types of content you want us to monitor across the web for the most relevant updates.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {CONTENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedContentTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      onClick={() => toggleContentType(type.id)}
                      className={`group p-6 rounded-[24px] border-2 text-left transition-all duration-300 ${
                        isSelected
                          ? 'border-indigo-600 bg-white shadow-2xl shadow-indigo-100'
                          : 'border-slate-50 bg-slate-50 hover:border-slate-100 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl transition-all duration-300 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-white text-slate-400 group-hover:text-slate-600'
                        }`}>
                          <Icon className="w-6 h-6" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] font-black uppercase tracking-widest ${
                              isSelected ? 'text-slate-900' : 'text-slate-500'
                            }`}>{type.label}</span>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                                 <Check className="w-3 h-3 text-white" strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 leading-tight">Custom monitoring</p>
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
              <div className="max-w-xl">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">Review <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Your Setup</span></h2>
                <p className="text-slate-500 font-bold leading-relaxed pr-8">
                  Review your business profile and monitoring settings before we start your daily scans.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Business Profile</h3>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">Company</span>
                          <span className="text-sm font-black text-slate-900">{companyName}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">Industry</span>
                          <span className="text-sm font-black text-slate-900">{industry}</span>
                       </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Monitored Topics ({selectedTopics.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedTopics.slice(0, 8).map((topic) => (
                        <span key={topic} className="px-3 py-1.5 bg-slate-100 text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-tight">
                          {topic}
                        </span>
                      ))}
                      {selectedTopics.length > 8 && (
                        <span className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">
                          +{selectedTopics.length - 8} More
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Content Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedContentTypes.map((typeId) => {
                        const type = CONTENT_TYPES.find((t) => t.id === typeId);
                        return (
                          <span key={typeId} className="px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">
                            {type?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-[40px] p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                     <Activity className="w-32 h-32 text-indigo-400" strokeWidth={1} />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="inline-block px-3 py-1 bg-indigo-500/20 rounded-lg border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-6">
                      Selected Plan
                    </div>
                    <h3 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">{getTierConfig(selectedTier).name} Plan</h3>
                    <p className="text-slate-400 font-bold text-xs leading-relaxed max-w-[200px]">
                       Proactive monitoring with daily scans and unlimited custom topics.
                    </p>
                  </div>

                  <div className="relative z-10 space-y-4 border-t border-white/5 pt-8 mt-12">
                     <div className="flex justify-between items-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                        <span>Credits / Mo</span>
                        <span className="text-white">{getTierConfig(selectedTier).monthlyCredits}</span>
                     </div>
                     <div className="flex justify-between items-baseline">
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Total Monthly</span>
                        <div className="text-right">
                           <span className="text-4xl font-black text-white">${pricing.monthly.toFixed(0)}</span>
                           <span className="text-indigo-400 text-xs font-black ml-1 uppercase">CAD</span>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-10 flex-1">
              <div className="max-w-xl">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">Secure <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Payment</span></h2>
                <p className="text-slate-500 font-bold leading-relaxed pr-8">
                  Securely add your payment method to activate your account and start your monitoring pipelines.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="bg-slate-50 rounded-[32px] p-8 border-2 border-slate-100">
                  <div className="mb-8 flex items-center gap-3 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100">
                     <Zap className="w-4 h-4 text-indigo-600" strokeWidth={3} />
                     <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">3-Day Free Trial Active</span>
                  </div>
                  
                  <Elements stripe={stripePromise}>
                    <StripeCardInput
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      buttonText={`Activate Account - ${formatCurrency(pricing.monthly)}/month`}
                      amount={pricing.monthly}
                      description={`Securely process your subscription. Cancel anytime.`}
                    />
                  </Elements>
                </div>

                <div className="space-y-6">
                  <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl relative overflow-hidden">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-white/5 rounded-2xl mb-6 border border-white/10">
                      <DollarSign className="w-6 h-6 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">{getTierConfig(selectedTier).name} Subscription</h3>
                    
                    <div className="space-y-3 mt-6 border-t border-white/5 pt-6">
                      <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-tight">
                        <span>Resource Allocation</span>
                        <span className="text-white">Full Access</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-tight">
                        <span>Manual Scan Clusters</span>
                        <span className="text-white">Unlimited</span>
                      </div>
                    </div>

                    <div className="mt-10 pt-6 border-t border-indigo-500/20">
                      <div className="flex items-baseline justify-between">
                        <span className="text-4xl font-black text-white">
                          ${pricing.monthly.toFixed(0)}
                        </span>
                        <span className="text-indigo-400 font-black text-xs uppercase tracking-widest">
                          / MONTH
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                        Securely processed via Stripe. Your data is encrypted using AES-256 standard. Charges appear as WATCHDOG_AI_LTD.
                     </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-12 flex-1 flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full animate-pulse" />
                <div className="relative z-10 w-24 h-24 rounded-[32px] bg-slate-900 flex items-center justify-center shadow-2xl shadow-indigo-500/50">
                   <Activity className="w-10 h-10 text-indigo-400" strokeWidth={3} />
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-indigo-600 border-4 border-white flex items-center justify-center shadow-lg">
                   <Check className="w-5 h-5 text-white" strokeWidth={4} />
                </div>
              </div>

              <div className="max-w-md">
                <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-none mb-4 uppercase">Setup <span className="text-indigo-600">Complete</span></h2>
                <p className="text-slate-500 font-bold text-lg leading-relaxed">
                  You're all set! We're starting your first scan now and will notify you of any findings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                <div className="p-8 bg-slate-50 rounded-[32px] border-2 border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Topics</span>
                  <span className="text-3xl font-black text-slate-900">{selectedTopics.length}</span>
                </div>

                <div className="p-8 bg-slate-50 rounded-[32px] border-2 border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Scan Credits</span>
                  <span className="text-3xl font-black text-indigo-600">∞</span>
                </div>

                <div className="p-8 bg-slate-50 rounded-[32px] border-2 border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tier Status</span>
                  <span className="text-3xl font-black text-slate-900">{getTierConfig(selectedTier).name.charAt(0)}</span>
                </div>
              </div>

              <div className="w-full max-w-lg p-8 bg-slate-900 rounded-[32px] text-left border border-white/10 shadow-2xl">
                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">What happens next</h4>
                 <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                       <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <Zap className="w-3 h-3" />
                       </div>
                       <p className="text-xs font-bold text-slate-300 leading-relaxed uppercase tracking-tight">System will start its initial scan immediately.</p>
                    </div>
                    <div className="flex gap-4 items-start">
                       <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <Zap className="w-3 h-3" />
                       </div>
                       <p className="text-xs font-bold text-slate-300 leading-relaxed uppercase tracking-tight">Results will appear in your dashboard within 60 seconds.</p>
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

        <div className="flex justify-between mt-12 mb-20 px-4">
          <button
            onClick={handleBack}
            disabled={currentStep === 1 || loading}
            className="flex items-center gap-3 px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={3} />
            Previous Step
          </button>

          <div className="flex items-center gap-12">
            <div className="hidden sm:flex flex-col items-end invisible opacity-0">
               <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Setup Progress</span>
               <span className="text-xs font-black text-slate-900 tracking-tighter">
                  {Math.round(((currentStep > 4 ? currentStep - 1 : currentStep) / 6) * 100)}% COMPLETE
               </span>
            </div>
            
            {currentStep === 8 ? (
              <button
                onClick={handleFinish}
                disabled={loading}
                className="group flex items-center gap-4 px-10 py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 hover:shadow-2xl hover:shadow-indigo-200 transition-all duration-300 disabled:opacity-50"
              >
                {loading ? 'Starting Platform...' : 'Start WatchDog'}
                <Zap className="w-5 h-5 group-hover:scale-125 transition-transform" />
              </button>
            ) : currentStep < 7 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className="group flex items-center gap-4 px-10 py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 hover:shadow-2xl hover:shadow-indigo-200 transition-all duration-300 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
              >
                {loading ? 'Processing...' : currentStep === 6 ? 'Finish Review' : 'Continue'}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

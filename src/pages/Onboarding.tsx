import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getTopicSuggestions, getSourceSuggestions } from '../utils/mockAI';
import { getTopicSuggestionsFromAI, getSourceSuggestionsFromAI, SourceSuggestion } from '../utils/perplexity';
import { generateMockUpdates } from '../utils/mockUpdates';
import { Activity, Check, ChevronRight, ChevronLeft, Plus, X, DollarSign, Newspaper, FileText, DollarSign as Grant, BarChart, Megaphone, Building2, Briefcase, AlertCircle, Zap } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import StripeCardInput from '../components/StripeCardInput';
import { formatCurrency, TIER_CONFIGS, SubscriptionTier, getTierConfig } from '../utils/pricing';

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
  { id: 'reports', label: 'Industry Reports & Research', icon: BarChart },
  { id: 'press', label: 'Press Releases & Announcements', icon: Megaphone },
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

  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [businessDescription, setBusinessDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [monitoringGoals, setMonitoringGoals] = useState<string[]>([]);

  const [locationCountry, setLocationCountry] = useState('');
  const [locationProvince, setLocationProvince] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [businessContext, setBusinessContext] = useState<string[]>([]);

  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');

  const [suggestedSources, setSuggestedSources] = useState<SourceSuggestion[]>([]);
  const [selectedSources, setSelectedSources] = useState<SourceSuggestion[]>([]);
  const [customSource, setCustomSource] = useState({ name: '', url: '', description: '', category: '', rssFeedUrl: '' });

  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(['news', 'legislation', 'government']);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('premium');

  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('biweekly');
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

  useEffect(() => {
    if (currentStep === 4 && selectedTopics.length > 0 && suggestedSources.length === 0) {
      loadSourceSuggestions();
    }
  }, [currentStep, selectedTopics]);

  const loadTopicSuggestions = async () => {
    setAiLoading(true);
    setAiError('');

    const timeoutId = setTimeout(() => {
      const fallbackTopics = getTopicSuggestions(businessDescription, industry);
      setSuggestedTopics(fallbackTopics);
      setAiError('Request timed out - showing curated topics');
      setAiLoading(false);
    }, 15000);

    try {
      const aiTopics = await getTopicSuggestionsFromAI(businessDescription, industry);

      clearTimeout(timeoutId);

      if (aiTopics && aiTopics.length > 0) {
        setSuggestedTopics(aiTopics);
        setAiError('');
      } else {
        const fallbackTopics = getTopicSuggestions(businessDescription, industry);
        setSuggestedTopics(fallbackTopics);
        setAiError('AI suggestions temporarily unavailable - showing curated topics');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error loading topic suggestions:', error);
      const fallbackTopics = getTopicSuggestions(businessDescription, industry);
      setSuggestedTopics(fallbackTopics);
      setAiError('AI suggestions temporarily unavailable - showing curated topics');
    } finally {
      setAiLoading(false);
    }
  };

  const loadSourceSuggestions = async () => {
    setAiLoading(true);
    setAiError('');

    const timeoutId = setTimeout(() => {
      setSuggestedSources([]);
      setAiError('Request timed out - you can skip this step or try again later');
      setAiLoading(false);
    }, 20000);

    try {
      const locationInfo = [locationCity, locationProvince, locationCountry].filter(Boolean).join(', ');
      const aiSources = await getSourceSuggestionsFromAI(
        selectedTopics,
        industry,
        businessDescription,
        locationInfo
      );

      clearTimeout(timeoutId);

      if (aiSources && aiSources.length >= 3) {
        const sortedSources = [...aiSources].sort((a, b) => {
          const scoreA = (a as any).relevanceScore || 5;
          const scoreB = (b as any).relevanceScore || 5;
          return scoreB - scoreA;
        });
        setSuggestedSources(sortedSources);
      } else {
        setSuggestedSources([]);
        setAiError('Unable to find quality sources for your specific needs. We\'ll use general search instead to find the most relevant updates for you.');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      setSuggestedSources([]);
      setAiError('Unable to find quality sources for your specific needs. We\'ll use general search instead to find the most relevant updates for you.');
    } finally {
      setAiLoading(false);
    }
  };

  const requestMoreSourcesByCategory = async (category: string) => {
    setRequestingMoreSources(true);
    setAiError('');

    try {
      const locationInfo = [locationCity, locationProvince, locationCountry].filter(Boolean).join(', ');
      const aiSources = await getSourceSuggestionsFromAI(
        selectedTopics,
        industry,
        businessDescription,
        locationInfo,
        category
      );

      if (aiSources && aiSources.length > 0) {
        const newSources = aiSources.filter(
          (newSource) => !suggestedSources.some((existing) => existing.url === newSource.url)
        );

        if (newSources.length > 0) {
          const sortedNewSources = [...newSources].sort((a, b) => {
            const scoreA = (a as any).relevanceScore || 5;
            const scoreB = (b as any).relevanceScore || 5;
            return scoreB - scoreA;
          });
          setSuggestedSources([...suggestedSources, ...sortedNewSources]);
        } else {
          setAiError(`No new ${category.toLowerCase()} sources found. Try a different category.`);
        }
      } else {
        setAiError(`No ${category.toLowerCase()} sources found for your topics.`);
      }
    } catch (error) {
      setAiError(`Unable to find more ${category.toLowerCase()} sources. Please try again.`);
    } finally {
      setRequestingMoreSources(false);
    }
  };

  const calculatePricing = () => {
    const tierConfig = getTierConfig(selectedTier);
    const monthly = tierConfig.monthlyPrice;
    return { monthly };
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
      console.log('Setting step to 2');
      setCurrentStep(2);
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
      for (const topic of selectedTopics) {
        const { error } = await supabase.from('topics').insert({
          profile_id: profile.id,
          company_id: currentCompany.id,
          topic_name: topic,
          is_custom: !suggestedTopics.includes(topic),
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
        subscription_frequency: 'weekly',
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

  const toggleSource = (source: SourceSuggestion) => {
    setSelectedSources((prev) => {
      const isSelected = prev.find((s) => s.url === source.url);
      if (isSelected) {
        return prev.filter((s) => s.url !== source.url);
      } else {
        // No source limit anymore
        return [...prev, source];
      }
    });
  };


  const addCustomSource = () => {
    if (customSource.name.trim() && customSource.url.trim()) {
      // No source limit anymore
      setSelectedSources((prev) => [...prev, customSource]);
      setCustomSource({ name: '', url: '', description: '', category: '', rssFeedUrl: '' });
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
      case 4:
        return selectedSources.length > 0 || (suggestedSources.length === 0 && !aiLoading);
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

  const pricing = calculatePricing();

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
        <div className="mb-8">
          <div className="flex items-center justify-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => (
              <div key={step} className="flex-1 flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-xs transition-all ${
                    step < currentStep
                      ? 'bg-green-500 text-white'
                      : step === currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < currentStep ? <Check className="w-3 h-3" /> : step}
                </div>
                {step < 8 && (
                  <div
                    className={`flex-1 h-1 mx-1 transition-all ${
                      step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between text-xs text-gray-600 px-1">
            <span className="text-center">Business</span>
            <span className="text-center">Topics</span>
            <span className="text-center">Plan</span>
            <span className="text-center">Sources</span>
            <span className="text-center">Content</span>
            <span className="text-center">Review</span>
            <span className="text-center">Complete</span>
            <span className="text-center"></span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 min-h-[500px]">
          {aiError && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">{aiError}</p>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about your business</h2>
                <p className="text-gray-600">Help us understand what you do so we can suggest relevant monitoring topics</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                  placeholder="Acme Inc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Description</label>
                <textarea
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none"
                  placeholder="What does your company do?"
                />
                <p className="mt-2 text-xs text-blue-600 font-medium">
                  Tip: The more detail you provide, the more tailored and relevant your results will be. Include specifics about your products, services, and target market.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                >
                  <option value="">Select your industry</option>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">What do you want to monitor?</label>
                <div className="grid grid-cols-2 gap-3">
                  {MONITORING_GOALS.map((goal) => (
                    <label
                      key={goal}
                      className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={monitoringGoals.includes(goal)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMonitoringGoals([...monitoringGoals, goal]);
                          } else {
                            setMonitoringGoals(monitoringGoals.filter(g => g !== goal));
                          }
                        }}
                        className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{goal}</span>
                    </label>
                  ))}
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
                  <strong>Tip:</strong> The more details you provide, the better our custom AI can recommend relevant sources and content for your needs.
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What topics should we monitor?</h2>
                <p className="text-gray-600">
                  {aiLoading ? 'AI is generating personalized suggestions...' : 'Select from our suggestions or add your own'}
                </p>
              </div>

              {aiLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-gray-600">Analyzing your business...</p>
                  </div>
                </div>
              ) : (
                <>
                  {suggestedTopics && suggestedTopics.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {suggestedTopics.map((topic) => (
                        <button
                          key={topic}
                          onClick={() => toggleTopic(topic)}
                          className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                            selectedTopics.includes(topic)
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{topic}</span>
                            {selectedTopics.includes(topic) && <Check className="w-5 h-5 text-indigo-600" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">No topic suggestions available yet.</p>
                      <button
                        onClick={loadTopicSuggestions}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Custom Topic</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomTopic()}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="e.g., Specific regulation or market segment"
                  />
                  <button
                    onClick={addCustomTopic}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {selectedTopics.filter((t) => !suggestedTopics.includes(t)).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Custom Topics</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTopics
                      .filter((t) => !suggestedTopics.includes(t))
                      .map((topic) => (
                        <span
                          key={topic}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-900 rounded-full text-sm"
                        >
                          {topic}
                          <button onClick={() => toggleTopic(topic)} className="hover:text-indigo-600">
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose your plan</h2>
                <p className="text-gray-600">Select a plan based on how many sources you need to monitor</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.values(TIER_CONFIGS).map((tier) => (
                  <button
                    key={tier.tier}
                    onClick={() => setSelectedTier(tier.tier)}
                    className={`border-2 rounded-xl p-6 text-left transition-all ${
                      selectedTier === tier.tier
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {tier.tier === 'premium' && (
                      <div className="inline-block px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full mb-3">
                        POPULAR
                      </div>
                    )}
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-blue-600">
                          {formatCurrency(tier.monthlyPrice)}
                        </span>
                        <span className="text-gray-600">/month</span>
                      </div>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {selectedTier === tier.tier && (
                      <div className="flex items-center justify-center w-full py-2 bg-blue-600 text-white rounded-lg font-semibold">
                        <Check className="w-5 h-5 mr-2" />
                        Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> You can customize your update frequency (weekly, bi-weekly, or monthly) after selecting your plan. All plans include AI-powered web scanning at no additional cost.
                </p>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Where should we monitor?</h2>
                <p className="text-gray-600">
                  {aiLoading ? 'AI is finding authoritative sources...' : 'Select relevant sources for your topics'}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Select any relevant sources to help our AI understand your monitoring needs.
                </p>
              </div>


              {aiLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="mt-4 text-gray-600">Discovering sources...</p>
                  </div>
                </div>
              ) : suggestedSources.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <Activity className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">We'll use AI web scanning instead</h3>
                  <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
                    We couldn't find specific sources that publish regular updates for your topics. That's okay - our AI will continuously scan the entire web to find the most relevant and recent updates for your business.
                  </p>
                  <div className="bg-white rounded-lg p-4 text-left max-w-md mx-auto mb-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">What this means:</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>✓ Comprehensive AI-powered web scanning</li>
                      <li>✓ Updates delivered to your dashboard in real-time</li>
                      <li>✓ No additional source monitoring costs</li>
                      <li>✓ All relevant content filtered to your business</li>
                    </ul>
                  </div>
                  {selectedSources.length > 0 && (
                    <div className="mt-6">
                      <p className="text-sm font-medium text-gray-700 mb-2">Your custom sources:</p>
                      <div className="space-y-2">
                        {selectedSources.map((source) => (
                          <div key={source.url} className="bg-white rounded-lg p-3 text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{source.name}</p>
                              {source.category && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded">
                                  {source.category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{source.url}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-blue-200 mt-6 pt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add a Custom Source (Optional)</label>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={customSource.name}
                        onChange={(e) => setCustomSource({ ...customSource, name: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        placeholder="Source name"
                      />
                      <input
                        type="url"
                        value={customSource.url}
                        onChange={(e) => setCustomSource({ ...customSource, url: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        placeholder="https://example.com"
                      />
                      <input
                        type="text"
                        value={customSource.category}
                        onChange={(e) => setCustomSource({ ...customSource, category: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                        placeholder="Category (e.g., News, Grants, Regulations)"
                      />
                      <button
                        onClick={addCustomSource}
                        disabled={!customSource.name || !customSource.url}
                        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Source
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                {suggestedSources.map((source) => {
                  const relevanceScore = source.relevanceScore || 8;
                  const isSelected = selectedSources.find((s) => s.url === source.url);
                  return (
                  <button
                    key={source.url}
                    onClick={() => {
                      const isSelected = selectedSources.find((s) => s.url === source.url);
                      const tierLimit = getTierConfig(selectedTier).sources;
                      
                      if (!isSelected && selectedSources.length >= tierLimit) {
                        alert(`Your ${getTierConfig(selectedTier).name} plan is limited to ${tierLimit} sources. Please upgrade to add more.`);
                        return;
                      }
                      toggleSource(source);
                    }}
                    className={`w-full px-4 py-4 rounded-lg border-2 text-left transition-all ${
                      selectedSources.find((s) => s.url === source.url)
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{source.name}</h3>
                          {source.category && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded">
                              {source.category}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                            {relevanceScore}/10
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{source.description}</p>
                        <p className="text-xs text-blue-600 mt-1">{source.url}</p>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                );
                })}
              </div>

              {selectedSources.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">
                        {selectedSources.length} {selectedSources.length === 1 ? 'source' : 'sources'} selected
                      </p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Active monitoring + timely updates to your dashboard
                      </p>
                    </div>
                  </div>
                </div>
              )}


              <div className="border-t pt-6">
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">Want to see more sources?</p>
                  <div className="flex flex-wrap gap-2">
                    {['Grants', 'News', 'Legislation', 'Reports', 'Government'].map((category) => (
                      <button
                        key={category}
                        onClick={() => requestMoreSourcesByCategory(category)}
                        disabled={requestingMoreSources}
                        className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-all text-sm font-medium border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {requestingMoreSources ? 'Loading...' : `${category}`}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Click to discover more sources in specific categories</p>
                </div>
              </div>

              <div className="border-t pt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Custom Source</label>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={customSource.name}
                    onChange={(e) => setCustomSource({ ...customSource, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="Source name"
                  />
                  <input
                    type="url"
                    value={customSource.url}
                    onChange={(e) => setCustomSource({ ...customSource, url: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="https://example.com"
                  />
                  <input
                    type="text"
                    value={customSource.category}
                    onChange={(e) => setCustomSource({ ...customSource, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="Category (e.g., News, Grants, Regulations)"
                  />
                  <input
                    type="text"
                    value={customSource.description}
                    onChange={(e) => setCustomSource({ ...customSource, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                    placeholder="Brief description (optional)"
                  />
                  <button
                    onClick={addCustomSource}
                    className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                  >
                    Add Source
                  </button>
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What types of information are you looking for?</h2>
                <p className="text-gray-600">Select all content types you want to monitor</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {CONTENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => toggleContentType(type.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedContentTypes.includes(type.id)
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          selectedContentTypes.includes(type.id)
                            ? 'bg-indigo-100 text-indigo-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{type.label}</span>
                            {selectedContentTypes.includes(type.id) && (
                              <Check className="w-5 h-5 text-indigo-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Plan</h2>
                <p className="text-gray-600">Confirm your selections before setting up your account</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Monitoring Plan</h3>
                    <p className="text-sm text-gray-600">{getTierConfig(selectedTier).name} Plan</p>
                    <p className="text-sm text-gray-600">${pricing.monthly.toFixed(0)}/month</p>
                    <p className="text-sm text-gray-600 mt-1">Manual scan credits included: {getTierConfig(selectedTier).monthlyCredits}</p>
                  </div>


                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Topics ({selectedTopics.length})</h3>
                    <div className="flex flex-wrap gap-1">
                      {selectedTopics.slice(0, 5).map((topic) => (
                        <span key={topic} className="text-xs px-2 py-1 bg-blue-100 text-blue-900 rounded">
                          {topic}
                        </span>
                      ))}
                      {selectedTopics.length > 5 && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          +{selectedTopics.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>



                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Content Types ({selectedContentTypes.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedContentTypes.map((typeId) => {
                        const type = CONTENT_TYPES.find((t) => t.id === typeId);
                        return (
                          <span
                            key={typeId}
                            className="text-xs px-3 py-1.5 bg-blue-100 text-blue-900 rounded-full font-medium"
                          >
                            {type?.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Configuration</h3>
                    <p className="text-sm text-gray-600">Delivery: Dashboard</p>
                    <p className="text-sm text-gray-600">First scan: Immediately after setup</p>
                    <p className="text-sm text-gray-500 italic mt-2">You can customize frequency and analysis settings later in Settings</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl mb-4 text-blue-600 shadow-sm font-bold text-xl">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Plan Summary</h3>


                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Plan type</span>
                      <span className="font-semibold text-blue-600">{getTierConfig(selectedTier).name}</span>
                    </div>

                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{getTierConfig(selectedTier).monthlyCredits} manual scan credits/month</span>
                      <span>Included</span>
                    </div>

                    <div className="flex justify-between text-sm text-gray-600">
                      <span>AI-powered web scanning</span>
                      <span>Included</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Dashboard delivery</span>
                      <span>Included</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Weekly automated scans</span>
                      <span>Included</span>
                    </div>
                  </div>

                  <div className="border-t border-blue-200 pt-4 mb-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-gray-900">
                        ${pricing.monthly.toFixed(0)}
                      </span>
                      <span className="text-gray-600">
                        /month
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Payment Details</h2>
                <p className="text-gray-600">Add your card to start your subscription</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 mb-6">
                <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">3-Day Free Trial Included</p>
                  <p className="text-sm text-blue-800">
                    Your card will not be charged for the first 72 hours. You can cancel anytime before the trial ends.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <Elements stripe={stripePromise}>
                    <StripeCardInput
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      buttonText={`Subscribe - ${formatCurrency(pricing.monthly)}/month`}
                      amount={pricing.monthly}
                      description={`You'll be charged ${formatCurrency(pricing.monthly)} monthly. Cancel anytime.`}
                    />
                  </Elements>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl mb-4">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Your {getTierConfig(selectedTier).name} Plan</h3>

                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Monthly subscription</span>
                      <span className="font-semibold">{formatCurrency(getTierConfig(selectedTier).monthlyPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Weekly automated scans</span>
                      <span>Included</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Unlimited manual scan credits</span>
                      <span>Included</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>AI-powered web scanning</span>
                      <span>Included</span>
                    </div>
                  </div>

                  <div className="border-t border-blue-200 pt-4 mb-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-gray-900">
                        ${pricing.monthly.toFixed(0)}
                      </span>
                      <span className="text-gray-600">
                        /month
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mb-6">
                  <Check className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">You're All Set!</h2>
                <p className="text-lg text-gray-600 mb-8">Click below to complete your setup and start monitoring</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl mb-4">
                    <Activity className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{selectedSources.length} Sources</h3>
                  <p className="text-sm text-gray-600">Ready to monitor</p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl mb-4">
                    <Zap className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">Unlimited Credits</h3>
                  <p className="text-sm text-gray-600">For manual scans</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-xl mb-4">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">Premium Features</h3>
                  <p className="text-sm text-gray-600">All features included</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Your account will be fully configured with your selected topics and sources</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>We'll run an initial scan to populate your dashboard with relevant updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>You can start exploring updates and customize your preferences in Settings</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {finishError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900 mb-1">Setup Error</p>
              <p className="text-sm text-red-800">{finishError}</p>
            </div>
            <button
              onClick={() => setFinishError('')}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 1 || loading}
            className="px-6 py-3 text-gray-700 font-medium rounded-lg hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          {currentStep === 8 ? (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Setting up your account...' : 'Complete Setup'}
              <Check className="w-5 h-5" />
            </button>
          ) : currentStep < 7 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Saving...' : currentStep === 6 ? 'Review & Finish' : 'Continue'}
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

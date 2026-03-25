import { useState, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getTopicSuggestions } from '../utils/mockAI';
import { getTopicSuggestionsFromAI, getSourceSuggestionsFromAI, SourceSuggestion } from '../utils/perplexity';
import { generateMockUpdates } from '../utils/mockUpdates';
import { 
  Building2, 
  Target, 
  Plus, 
  Search, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Globe, 
  Zap, 
  AlertCircle,
  Activity,
  DollarSign as Grant,
  DollarSign,
  Newspaper,
  Rocket,
  FileText,
  BarChart,
  Megaphone,
  Briefcase,
  X,
  Sparkles
} from 'lucide-react';
import Sidebar from '../components/Sidebar';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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

export default function AddCompany() {
  const { user, refreshProfile, addCompany: addCompanyToAuth } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [finishError, setFinishError] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [billingAcknowledged, setBillingAcknowledged] = useState(false);

  const [companyName, setCompanyName] = useState('');
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

  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'biweekly'>('biweekly');
  const [analysisDepth, setAnalysisDepth] = useState<'standard' | 'deep'>('standard');
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [competitorInput, setCompetitorInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [resultsPerScan, setResultsPerScan] = useState(10);
  const [requestingMoreSources, setRequestingMoreSources] = useState(false);
  const [showAnnual, setShowAnnual] = useState(false);

  useEffect(() => {
    if (currentStep === 3 && businessDescription && industry && suggestedTopics.length === 0) {
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

    try {
      const aiTopics = await getTopicSuggestionsFromAI(businessDescription, industry);

      if (aiTopics && aiTopics.length > 0) {
        setSuggestedTopics(aiTopics);
      } else {
        const fallbackTopics = getTopicSuggestions(businessDescription, industry);
        setSuggestedTopics(fallbackTopics);
        setAiError('AI suggestions temporarily unavailable - showing curated topics');
      }
    } catch (error) {
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

    try {
      const locationInfo = [locationCity, locationProvince, locationCountry].filter(Boolean).join(', ');
      const aiSources = await getSourceSuggestionsFromAI(
        selectedTopics,
        industry,
        businessDescription,
        locationInfo
      );

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
          (newSource: SourceSuggestion) => !suggestedSources.some((existing: SourceSuggestion) => existing.url === newSource.url)
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
    const basePrices = { monthly: 29, biweekly: 49, weekly: 69 };
    const basePrice = basePrices[frequency as keyof typeof basePrices];
    const sourceCost = selectedSources.length * 3;
    const contentTypeCost = selectedContentTypes.length * 5;
    const analysisCost = analysisDepth === 'deep' ? 25 : 0;

    const monthly = basePrice + sourceCost + contentTypeCost + analysisCost;
    const annual = monthly * 12 * 0.75;

    return { monthly, annual };
  };

  const handleNext = async () => {
    if (currentStep < 7) {
      setCurrentStep((prev: Step) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev: Step) => (prev - 1) as Step);
    }
  };

  const handleFinish = async () => {
    if (!user) {
      setFinishError('User not found. Please try logging in again.');
      return;
    }

    if (!billingAcknowledged) {
      setFinishError('Please acknowledge that you understand you will be billed for this company.');
      return;
    }

    setLoading(true);
    setFinishError('');

    try {
      const { error: companyError, company } = await addCompanyToAuth({
        name: companyName,
        industry,
        description: businessDescription,
        monitoring_goals: monitoringGoals.join(', '),
        location_country: locationCountry,
        location_province: locationProvince,
        location_city: locationCity,
        business_context: businessContext,
        content_types: selectedContentTypes,
        analysis_depth: analysisDepth,
        results_per_scan: resultsPerScan,
        subscription_frequency: frequency,
      });

      if (companyError || !company) {
        throw new Error(companyError?.message || 'Failed to create company');
      }

      for (const topic of selectedTopics) {
        const { error } = await supabase.from('topics').insert({
          profile_id: company.id,
          topic_name: topic,
          is_custom: !suggestedTopics.includes(topic),
        });
        if (error) throw new Error(`Failed to save topics: ${error.message}`);
      }

      const sourcesData = [];
      for (const source of selectedSources) {
        const { data, error } = await supabase.from('sources').insert({
          profile_id: company.id,
          name: source.name,
          url: source.url,
          description: source.description,
          rss_feed_url: source.rssFeedUrl || '',
          is_approved: true,
          is_core_source: true,
        }).select();
        if (error) throw new Error(`Failed to save sources: ${error.message}`);
        if (data) sourcesData.push(data[0] as any);
      }

      for (const competitor of competitors) {
        const { error } = await supabase.from('competitors').insert({
          profile_id: company.id,
          name: competitor,
        });
        if (error) throw new Error(`Failed to save competitors: ${error.message}`);
      }

      for (const keyword of keywords) {
        const { error } = await supabase.from('keywords').insert({
          profile_id: company.id,
          keyword: keyword,
        });
        if (error) throw new Error(`Failed to save keywords: ${error.message}`);
      }

      const pricing = calculatePricing();
      const today = new Date().toISOString().split('T')[0];
      const { error: subscriptionError } = await supabase.from('subscriptions').insert({
        profile_id: company.id,
        frequency: frequency,
        delivery_method: 'dashboard',
        relevance_threshold: 1,
        first_update_date: today,
        monthly_price: pricing.monthly,
        annual_price: pricing.annual,
      });
      if (subscriptionError) throw new Error(`Failed to save subscription: ${subscriptionError.message}`);

      try {
        await generateMockUpdates(
          company.id,
          businessDescription,
          industry,
          sourcesData,
          selectedTopics,
          selectedContentTypes
        );
      } catch (mockError) {
        console.warn('Failed to generate mock updates:', mockError);
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const today = new Date().toISOString().split('T')[0];
        const dateFromObj = new Date();
        dateFromObj.setDate(dateFromObj.getDate() - 7);
        const dateFrom = dateFromObj.toISOString().split('T')[0];

        const perplexityResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-perplexity-updates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            topics: selectedTopics,
            sources: sourcesData.map((s: any) => ({
              name: s.name,
              url: s.url,
              rss_feed_url: s.rss_feed_url
            })),
            contentTypes: selectedContentTypes,
            businessDescription: businessDescription,
            industry: industry,
            monitoringGoals: monitoringGoals.join(', '),
            location: [locationCity, locationProvince, locationCountry].filter(Boolean).join(', '),
            businessContext: businessContext.join(', '),
            dateFrom,
            dateTo: today,
            scanOptions: {
              depth: analysisDepth,
              priority: 'balanced',
              maxArticles: resultsPerScan,
              timeRange: '7days'
            }
          }),
        });

        const perplexityData = await perplexityResponse.json();
        const allUpdates = perplexityData.updates || [];

        if (sourcesData.length > 0) {
          const monitorResponse = await fetch(`${supabaseUrl}/functions/v1/monitor-tracked-sources`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              profileId: company.id,
            }),
          });

          if (monitorResponse.ok) {
            const monitorData = await monitorResponse.json();
            if (monitorData.updates && monitorData.updates.length > 0) {
              allUpdates.push(...monitorData.updates);
            }
          }
        }

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

        const researchTopics = [
          ...selectedTopics.map((t: string) => ({ topic: t, tags: [] })),
          ...competitors.map((c: string) => ({ topic: c, tags: ['Competitor'] }))
        ];

        fetch(`${supabaseUrl}/functions/v1/generate-background-research`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            profileId: company.id,
            topics: researchTopics,
            depth: analysisDepth,
          }),
        }).catch(err => console.warn('Background research failed:', err));
      } catch (scanError) {
        console.warn('Failed to run initial scan:', scanError);
      }

      await refreshProfile();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error adding company:', error);
      setFinishError(error instanceof Error ? error.message : 'Failed to add company. Please try again.');
      setLoading(false);
    }
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev: string[]) =>
      prev.includes(topic) ? prev.filter((t: string) => t !== topic) : [...prev, topic]
    );
  };

  const addCustomTopic = () => {
    if (customTopic.trim()) {
      setSelectedTopics((prev: string[]) => [...prev, customTopic.trim()]);
      setCustomTopic('');
    }
  };

  const toggleSource = (source: SourceSuggestion) => {
    setSelectedSources((prev: SourceSuggestion[]) =>
      prev.find((s: SourceSuggestion) => s.url === source.url)
        ? prev.filter((s: SourceSuggestion) => s.url !== source.url)
        : [...prev, source]
    );
  };

  const addCustomSource = () => {
    if (customSource.name.trim() && customSource.url.trim()) {
      setSelectedSources((prev: SourceSuggestion[]) => [...prev, customSource]);
      setCustomSource({ name: '', url: '', description: '', category: '', rssFeedUrl: '' });
    }
  };

  const toggleContentType = (typeId: string) => {
    setSelectedContentTypes((prev: string[]) =>
      prev.includes(typeId) ? prev.filter((t: string) => t !== typeId) : [...prev, typeId]
    );
  };

  const addCompetitor = () => {
    if (competitorInput.trim()) {
      setCompetitors((prev: string[]) => [...prev, competitorInput.trim()]);
      setCompetitorInput('');
    }
  };

  const removeCompetitor = (index: number) => {
    setCompetitors((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      setKeywords((prev) => [...prev, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords((prev: string[]) => prev.filter((_: string, i: number) => i !== index));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return companyName && businessDescription && industry;
      case 2:
        return true;
      case 3:
        return selectedTopics.length > 0;
      case 4:
        return selectedSources.length > 0 || (suggestedSources.length === 0 && !aiLoading);
      case 5:
        return selectedContentTypes.length > 0;
      case 6:
        return true;
      case 7:
        return billingAcknowledged;
      default:
        return false;
    }
  };

  const pricing = calculatePricing();

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <Sidebar />
      
      <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar relative">
        {/* Background glow effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto w-full px-12 py-16 flex flex-col min-h-full">
          {/* Header & Steps */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
                  <Plus className="w-6 h-6 text-white" strokeWidth={3} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight uppercase">New <span className="text-blue-500">Intelligence</span></h1>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Deploying a new monitoring node</p>
                </div>
              </div>
              
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 bg-slate-900/50 border border-slate-800/50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 hover:text-white transition-all"
              >
                Abort Deployment
              </button>
            </div>

            <div className="flex items-center justify-between mb-6 px-2">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => (
                <div key={step} className="flex-1 flex items-center group">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-2xl font-black text-xs transition-all duration-500 relative ${
                      step < currentStep
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : step === currentStep
                        ? 'bg-white text-slate-900 shadow-2xl shadow-white/10 ring-4 ring-blue-600/20'
                        : 'bg-slate-900 border border-slate-800 text-slate-600'
                    }`}
                  >
                    {step < currentStep ? <Check className="w-5 h-5" strokeWidth={4} /> : step}
                    
                    {step === currentStep && (
                      <div className="absolute -bottom-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                    )}
                  </div>
                  {step < 7 && (
                    <div
                      className={`flex-1 h-0.5 mx-3 transition-all duration-700 rounded-full ${
                        step < currentStep ? 'bg-blue-600' : 'bg-slate-800'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">
              <span className={currentStep === 1 ? 'text-blue-400' : ''}>Business</span>
              <span className={currentStep === 2 ? 'text-blue-400' : ''}>Location</span>
              <span className={currentStep === 3 ? 'text-blue-400' : ''}>Topics</span>
              <span className={currentStep === 4 ? 'text-blue-400' : ''}>Sources</span>
              <span className={currentStep === 5 ? 'text-blue-400' : ''}>Content</span>
              <span className={currentStep === 6 ? 'text-blue-400' : ''}>Config</span>
              <span className={currentStep === 7 ? 'text-blue-400' : ''}>Review</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
          {aiError && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">{aiError}</p>
            </div>
          )}

            {currentStep === 1 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                  <h2 className="text-5xl font-black text-white tracking-tighter mb-4 leading-tight">Identify the <span className="text-blue-500">Target.</span></h2>
                  <p className="text-lg font-bold text-slate-400 leading-relaxed max-w-2xl">Establish the core identity of the business unit. Our AI uses this to calibrate the entire monitoring mesh.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Company Identity</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Building2 className="w-5 h-5 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
                        className="w-full pl-14 pr-6 py-5 bg-slate-900/50 border border-slate-800 rounded-2xl text-white font-bold placeholder:text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all outline-none"
                        placeholder="e.g. Black Swan Automations"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Market Sector</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <Activity className="w-5 h-5 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <select
                        value={industry}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setIndustry(e.target.value)}
                        className="w-full pl-14 pr-6 py-5 bg-slate-900/50 border border-slate-800 rounded-2xl text-white font-bold appearance-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all outline-none"
                      >
                        <option value="" className="bg-slate-950">Select Sector</option>
                        {INDUSTRY_OPTIONS.map((ind) => (
                          <option key={ind} value={ind} className="bg-slate-950">
                            {ind}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Mission Profile (Business Description)</label>
                  <div className="relative group">
                    <textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      rows={4}
                      className="w-full px-6 py-5 bg-slate-900/50 border border-slate-800 rounded-3xl text-white font-bold placeholder:text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all outline-none resize-none leading-relaxed"
                      placeholder="Describe the company's core operations, products, and value proposition..."
                    />
                    <div className="absolute top-5 right-5 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <Zap className="w-4 h-4 text-blue-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      Our Neural Engine uses this description to filter 99% of irrelevant noise.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Primary Monitoring Vectors</label>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {MONITORING_GOALS.map((goal) => {
                      const isSelected = monitoringGoals.includes(goal);
                      return (
                        <label
                          key={goal}
                          className={`flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.02] active:scale-95 ${
                            isSelected
                              ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/5'
                              : 'bg-slate-900/30 border-slate-800/50 hover:bg-slate-800/50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            isSelected ? 'bg-blue-500 border-blue-500 shadow-md shadow-blue-500/20' : 'bg-slate-950 border-slate-700 group-hover:border-slate-500'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMonitoringGoals([...monitoringGoals, goal]);
                              } else {
                                setMonitoringGoals(monitoringGoals.filter((g: string) => g !== goal));
                              }
                            }}
                            className="hidden"
                          />
                          <span className={`text-xs font-black uppercase tracking-tight transition-colors ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                            {goal}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
                <div>
                  <h2 className="text-5xl font-black text-white tracking-tighter mb-4 leading-tight">Geographic <span className="text-blue-500">Node Hub.</span></h2>
                  <p className="text-lg font-bold text-slate-400 leading-relaxed max-w-2xl">Specify where this entity operates. Geographic pinpointing dramatically increases intelligence precision.</p>
                </div>

                <div className="p-8 bg-blue-600/5 border border-blue-500/20 rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Search className="w-16 h-16 text-blue-400" />
                  </div>
                  <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3">Neural Calibrator</h3>
                  <p className="text-sm font-bold text-slate-400 leading-relaxed relative z-10">
                    Our AI cross-references local laws, regional news outlets, and municipal updates based on these parameters. 
                    <span className="text-white ml-1">Leaving fields blank will default to global monitoring.</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 text-center block">Country / Region</label>
                    <input
                      type="text"
                      value={locationCountry}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setLocationCountry(e.target.value)}
                      className="w-full px-6 py-5 bg-slate-900/50 border border-slate-800 rounded-2xl text-white font-bold placeholder:text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all outline-none text-center"
                      placeholder="CAN"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 text-center block">Province / State</label>
                    <input
                      type="text"
                      value={locationProvince}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setLocationProvince(e.target.value)}
                      className="w-full px-6 py-5 bg-slate-900/50 border border-slate-800 rounded-2xl text-white font-bold placeholder:text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all outline-none text-center"
                      placeholder="BC"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 text-center block">City / Local</label>
                    <input
                      type="text"
                      value={locationCity}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setLocationCity(e.target.value)}
                      className="w-full px-6 py-5 bg-slate-900/50 border border-slate-800 rounded-2xl text-white font-bold placeholder:text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all outline-none text-center"
                      placeholder="Vancouver"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Operational Taxonomy (Business Context)</label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { id: 'non-profit', label: 'Non-profit' },
                      { id: 'government', label: 'Government' },
                      { id: 'b2b', label: 'B2B Sector' },
                      { id: 'b2c', label: 'B2C Sector' },
                      { id: 'startup', label: 'Early Stage' },
                      { id: 'enterprise', label: 'Enterprise' },
                      { id: 'regulated', label: 'Regulated' },
                    ].map((context) => {
                      const isSelected = businessContext.includes(context.id);
                      return (
                        <label
                          key={context.id}
                          className={`flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.05] ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-500/20'
                              : 'bg-slate-900/30 border-slate-800/50 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              if (e.target.checked) {
                                setBusinessContext([...businessContext, context.id]);
                              } else {
                                setBusinessContext(businessContext.filter((c: string) => c !== context.id));
                              }
                            }}
                            className="hidden"
                          />
                          <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                            {context.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
                <div>
                  <h2 className="text-5xl font-black text-white tracking-tighter mb-4 leading-tight">Intelligence <span className="text-blue-500">Vectors.</span></h2>
                  <p className="text-lg font-bold text-slate-400 leading-relaxed max-w-2xl">
                    {aiLoading ? 'Our Neural Engine is synthesizing data...' : 'Select the specific signals you want to amplify. Precision here drives higher ROI.'}
                  </p>
                </div>

                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-slate-800/50 rounded-3xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />
                    <div className="relative z-10 text-center">
                      <div className="inline-flex items-center justify-center p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20 mb-6 animate-bounce">
                        <Zap className="w-10 h-10 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Analyzing Business DNA</h3>
                      <p className="text-slate-500 font-bold">Identifying optimal monitoring channels for this profile...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-4">
                      {suggestedTopics.map((topic) => {
                        const isSelected = selectedTopics.includes(topic);
                        return (
                          <button
                            key={topic}
                            onClick={() => toggleTopic(topic)}
                            className={`flex items-center justify-between px-6 py-5 rounded-2xl border transition-all group ${
                              isSelected
                                ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-500/20 scale-[1.02]'
                                : 'bg-slate-900/30 border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/50'
                            }`}
                          >
                            <span className={`text-sm font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                              {topic}
                            </span>
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected ? 'bg-white border-white' : 'bg-slate-950 border-slate-700'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={4} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Inject Custom Vector</label>
                      <div className="flex gap-3">
                        <div className="relative flex-1 group">
                          <input
                            type="text"
                            value={customTopic}
                            onChange={(e) => setCustomTopic(e.target.value)}
                            onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && addCustomTopic()}
                            className="w-full px-6 py-5 bg-slate-900/50 border border-slate-800 rounded-2xl text-white font-bold placeholder:text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all outline-none"
                            placeholder="Specify unique monitoring requirement..."
                          />
                        </div>
                        <button
                          onClick={addCustomTopic}
                          className="px-8 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                          Inject
                        </button>
                      </div>
                    </div>

                    {selectedTopics.filter((t) => !suggestedTopics.includes(t)).length > 0 && (
                      <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Custom Vector Stack</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedTopics
                            .filter((t) => !suggestedTopics.includes(t))
                            .map((topic) => (
                              <div
                                key={topic}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-xl text-xs font-black uppercase tracking-tight"
                              >
                                {topic}
                                <button onClick={() => toggleTopic(topic)} className="hover:text-blue-300 transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
                <div>
                  <h2 className="text-5xl font-black text-white tracking-tighter mb-4 leading-tight">Data <span className="text-blue-500">Pipeline.</span></h2>
                  <p className="text-lg font-bold text-slate-400 leading-relaxed max-w-2xl">
                    {aiLoading ? 'Calibrating sensory arrays...' : 'Select the primary sources for automated surveillance. Web Scanning is active by default.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-8 bg-blue-600/5 border border-blue-500/20 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <Globe className="w-20 h-20 text-blue-400" />
                    </div>
                    <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Neural Mesh (Standard)</h3>
                    <p className="text-sm font-bold text-slate-300 leading-relaxed mb-6">
                      Our AI continuously scans 10M+ data points across the global web for your specific monitoring vectors.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-500/10 w-fit px-3 py-1 rounded-full border border-blue-500/20">
                      <Check className="w-3 h-3" />
                      Active by default
                    </div>
                  </div>

                  <div className="p-8 bg-blue-600/10 border border-blue-500/40 rounded-3xl relative overflow-hidden group shadow-lg shadow-blue-500/10">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                      <Target className="w-20 h-20 text-blue-400" />
                    </div>
                    <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4">Targeted Monitoring</h3>
                    <p className="text-sm font-bold text-slate-200 leading-relaxed mb-6">
                      Add specific authoritative sources (Gov, Legal, Press) for deterministic priority monitoring.
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black text-white uppercase tracking-widest">
                        Cost: $3 / source
                      </div>
                      <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">
                        Selected: {selectedSources.length}
                      </div>
                    </div>
                  </div>
                </div>

                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-slate-800/50 rounded-3xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />
                    <div className="relative z-10 text-center">
                      <div className="inline-flex items-center justify-center p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20 mb-6 animate-pulse">
                        <Search className="w-10 h-10 text-blue-500" />
                      </div>
                      <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Scanning Web Archives</h3>
                      <p className="text-slate-500 font-bold">Pinpointing authoritative domains for your sector...</p>
                    </div>
                  </div>
                ) : suggestedSources.length === 0 ? (
                  <div className="p-12 bg-slate-900/40 border border-slate-800/80 rounded-3xl text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-blue-600/10 rounded-2xl border border-blue-500/20 flex items-center justify-center mb-6">
                      <Zap className="w-10 h-10 text-blue-500" />
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">Universal Coverage Target Reached.</h3>
                    <p className="text-slate-400 font-bold max-w-lg mb-8">
                      We didn't find specific low-noise sources. Our AI will utilize its <span className="text-blue-500">Universal Mesh</span> to track these topics across the entire open web.
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                      {[
                        'Comprehensive Web Scanning',
                        'Real-time Result Injection',
                        'Zero Additional Overhead',
                        'Intelligent Sector Filtering'
                      ].map(feature => (
                        <div key={feature} className="p-4 bg-slate-950/50 border border-slate-800/50 rounded-xl text-[10px] font-black text-blue-400 uppercase tracking-widest">
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {suggestedSources.map((source) => {
                        const isSelected = selectedSources.find((s) => s.url === source.url);
                        return (
                          <button
                            key={source.url}
                            onClick={() => toggleSource(source)}
                            className={`flex flex-col gap-3 p-6 rounded-2xl border text-left transition-all group ${
                              isSelected
                                ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-500/20 scale-[1.02]'
                                : 'bg-slate-900/30 border-slate-800/50 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <h3 className={`font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-200'}`}>{source.name}</h3>
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                isSelected ? 'bg-white border-white' : 'bg-slate-950 border-slate-700'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={4} />}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {source.category && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-600/10 text-blue-400 border border-blue-500/20'}`}>
                                  {source.category}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${isSelected ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                Score: {source.relevanceScore || 8}/10
                              </span>
                            </div>
                            <p className={`text-sm font-bold leading-relaxed line-clamp-2 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>{source.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-10 bg-slate-900/50 border border-slate-800 rounded-3xl">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Manual Source Injection</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                          type="text"
                          value={customSource.name}
                          onChange={(e) => setCustomSource({ ...customSource, name: e.target.value })}
                          className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold placeholder:text-slate-800 focus:border-blue-500/50 outline-none transition-all"
                          placeholder="Source Name"
                        />
                        <input
                          type="url"
                          value={customSource.url}
                          onChange={(e) => setCustomSource({ ...customSource, url: e.target.value })}
                          className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold placeholder:text-slate-800 focus:border-blue-500/50 outline-none transition-all"
                          placeholder="https://authoritative-domain.com"
                        />
                      </div>
                      <button
                        onClick={addCustomSource}
                        disabled={!customSource.name || !customSource.url}
                        className="w-full py-4 bg-slate-800 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 active:scale-[0.99]"
                      >
                        Add to Monitoring Mesh
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
                <div>
                  <h2 className="text-5xl font-black text-white tracking-tighter mb-4 leading-tight">Signal <span className="text-blue-500">Taxonomy.</span></h2>
                  <p className="text-lg font-bold text-slate-400 leading-relaxed max-w-2xl">Select the specific transmission formats our AI should monitor. Diversification increases intelligence depth.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {CONTENT_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = selectedContentTypes.includes(type.id);
                    return (
                      <button
                        key={type.id}
                        onClick={() => toggleContentType(type.id)}
                        className={`p-6 rounded-2xl border transition-all text-left flex flex-col gap-4 group hover:scale-[1.02] active:scale-95 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-500/20'
                            : 'bg-slate-900/30 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`p-3 rounded-xl transition-colors ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-blue-600/10 text-blue-500 border border-blue-500/20'
                          }`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            isSelected ? 'bg-white border-white' : 'bg-slate-950 border-slate-700'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" strokeWidth={4} />}
                          </div>
                        </div>
                        <div>
                          <h4 className={`text-sm font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {type.label}
                          </h4>
                          <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                            Surveillance active
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
                <div>
                  <h2 className="text-5xl font-black text-white tracking-tighter mb-4 leading-tight">Sync <span className="text-blue-500">Parameters.</span></h2>
                  <p className="text-lg font-bold text-slate-400 leading-relaxed max-w-2xl">Configure the cadence and depth of the Neural Engine. High-frequency scans provide the sharpest edge.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Update Cadence</label>
                    <div className="grid grid-cols-1 gap-3">
                      {(['weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                        <button
                          key={freq}
                          onClick={() => setFrequency(freq)}
                          className={`flex items-center justify-between px-6 py-5 rounded-2xl border transition-all group ${
                            frequency === freq
                              ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-500/20'
                              : 'bg-slate-900/30 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                              frequency === freq ? 'bg-white/20' : 'bg-slate-950 border border-slate-800'
                            }`}>
                              <Activity className={`w-5 h-5 ${frequency === freq ? 'text-white' : 'text-slate-600'}`} />
                            </div>
                            <span className={`text-sm font-black uppercase tracking-tight ${frequency === freq ? 'text-white' : 'text-slate-400'}`}>
                              {freq === 'biweekly' ? 'Bi-Weekly' : freq}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-black ${frequency === freq ? 'text-white' : 'text-blue-500'}`}>
                              ${{ weekly: 69, biweekly: 49, monthly: 29 }[freq]}
                            </div>
                            <div className={`text-[10px] uppercase font-black tracking-widest ${frequency === freq ? 'text-blue-100' : 'text-slate-600'}`}>
                              / Month
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Analysis Protocol</label>
                    <div className="grid grid-cols-1 gap-3">
                      {(['standard', 'deep'] as const).map((depth) => (
                        <button
                          key={depth}
                          onClick={() => setAnalysisDepth(depth)}
                          className={`flex items-center justify-between px-6 py-5 rounded-2xl border transition-all group ${
                            analysisDepth === depth
                              ? 'bg-blue-600 border-blue-500 shadow-xl shadow-blue-500/20'
                              : 'bg-slate-900/30 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                              analysisDepth === depth ? 'bg-white/20' : 'bg-slate-950 border border-slate-800'
                            }`}>
                              {depth === 'deep' ? <Rocket className={`w-5 h-5 ${analysisDepth === depth ? 'text-white' : 'text-slate-600'}`} /> : <Zap className={`w-5 h-5 ${analysisDepth === depth ? 'text-white' : 'text-slate-600'}`} />}
                            </div>
                            <span className={`text-sm font-black uppercase tracking-tight ${analysisDepth === depth ? 'text-white' : 'text-slate-400'}`}>
                              {depth} Protocol
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm font-black ${analysisDepth === depth ? 'text-white' : 'text-blue-500'}`}>
                              {depth === 'standard' ? 'Included' : '+$25'}
                            </div>
                            <div className={`text-[10px] uppercase font-black tracking-widest ${analysisDepth === depth ? 'text-blue-100' : 'text-slate-600'}`}>
                              {depth === 'standard' ? 'Default' : '/ Month'}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Competitor Intercepts</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={competitorInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompetitorInput(e.target.value)}
                        onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && addCompetitor()}
                        className="flex-1 px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-xl text-white font-bold placeholder:text-slate-800 focus:border-blue-500/50 outline-none transition-all"
                        placeholder="Intercept entity..."
                      />
                      <button onClick={addCompetitor} className="p-4 bg-slate-800 text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {competitors.map((c, i) => (
                        <div key={i} className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2">
                          {c}
                          <button onClick={() => removeCompetitor(i)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Keyword Triggers</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeywordInput(e.target.value)}
                        onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && addKeyword()}
                        className="flex-1 px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-xl text-white font-bold placeholder:text-slate-800 focus:border-blue-500/50 outline-none transition-all"
                        placeholder="Keyword trigger..."
                      />
                      <button onClick={addKeyword} className="p-4 bg-slate-800 text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {keywords.map((k, i) => (
                        <div key={i} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2">
                          {k}
                          <button onClick={() => removeKeyword(i)} className="hover:text-blue-300"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 7 && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div>
                  <h2 className="text-5xl font-black text-white tracking-tighter mb-4 leading-tight">Final <span className="text-blue-500">Review.</span></h2>
                  <p className="text-lg font-bold text-slate-400 leading-relaxed max-w-2xl">Confirm your intelligence configuration. All parameters can be modified later in the command console.</p>
                </div>

                <div className="p-8 bg-red-600/10 border border-red-500/30 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <AlertCircle className="w-20 h-20 text-red-500" />
                  </div>
                  <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">Subscription Protocol</h3>
                  <p className="text-sm font-black text-slate-200 leading-relaxed mb-6 max-w-xl">
                    By initializing this entity, you authorize an additional recurring charge of <span className="text-red-500">${pricing.monthly}/mo</span>.
                  </p>
                  <label className="flex items-center gap-4 group cursor-pointer">
                    <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                      billingAcknowledged ? 'bg-red-600 border-red-600 shadow-lg shadow-red-500/20' : 'bg-slate-950 border-slate-800 group-hover:border-red-500/50'
                    }`}>
                      {billingAcknowledged && <Check className="w-4 h-4 text-white" strokeWidth={4} />}
                    </div>
                    <input
                      type="checkbox"
                      checked={billingAcknowledged}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBillingAcknowledged(e.target.checked)}
                      className="hidden"
                    />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-red-500 transition-colors">
                      Authorize billing for {companyName || 'this entity'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Target Profile</h4>
                      <p className="text-xl font-black text-white tracking-tight">{companyName}</p>
                      <p className="text-sm font-bold text-blue-500 mt-1 uppercase tracking-widest">{industry}</p>
                    </div>

                    <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Active Vectors ({selectedTopics.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTopics.map(t => (
                          <span key={t} className="px-3 py-1 bg-slate-950 border border-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-tight">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-8 bg-blue-600/5 border border-blue-500/20 rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <DollarSign className="w-24 h-24 text-blue-400" />
                    </div>
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-6">Financial Summary</h4>
                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-center py-3 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Base Protocol</span>
                        <span className="text-sm font-black text-white">${{ weekly: 69, biweekly: 49, monthly: 29 }[frequency]}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Domain Hooks ({selectedSources.length})</span>
                        <span className="text-sm font-black text-white">${selectedSources.length * 3}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Signal Types ({selectedContentTypes.length})</span>
                        <span className="text-sm font-black text-white">${selectedContentTypes.length * 5}</span>
                      </div>
                      {analysisDepth === 'deep' && (
                        <div className="flex justify-between items-center py-3 border-b border-slate-800">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Deep Analysis</span>
                          <span className="text-sm font-black text-white">$25</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Monthly Aggregate</p>
                        <p className="text-4xl font-black text-white tracking-tighter">${pricing.monthly.toFixed(0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Annual Savings</p>
                        <p className="text-sm font-black text-blue-400">-$240.00 / yr</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-10 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1 || loading}
              className="px-8 py-4 text-slate-500 font-black text-sm uppercase tracking-widest hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-3"
            >
              <ChevronLeft className="w-5 h-5" />
              Return
            </button>

            <div className="flex items-center gap-8">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Protocol Progress</span>
                <span className="text-sm font-black text-white">Step {currentStep} of 7</span>
              </div>
              
              {currentStep < 7 ? (
                <button
                  onClick={handleNext}
                  disabled={loading}
                  className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Advance'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={loading || !billingAcknowledged}
                  className="px-12 py-5 bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3 disabled:opacity-50"
                >
                  {loading ? 'Initializing Mesh...' : 'Initialize Monitoring'}
                  <Sparkles className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

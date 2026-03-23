import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getTopicSuggestions, getSourceSuggestions } from '../utils/mockAI';
import { getTopicSuggestionsFromAI, getSourceSuggestionsFromAI, SourceSuggestion } from '../utils/perplexity';
import { generateMockUpdates } from '../utils/mockUpdates';
import { Activity, Check, ChevronRight, ChevronLeft, Plus, X, DollarSign, Newspaper, FileText, DollarSign as Grant, BarChart, Megaphone, Building2, Briefcase, AlertCircle } from 'lucide-react';

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
    const basePrices = { monthly: 29, biweekly: 49, weekly: 69 };
    const basePrice = basePrices[frequency];
    const sourceCost = selectedSources.length * 3;
    const contentTypeCost = selectedContentTypes.length * 5;
    const analysisCost = analysisDepth === 'deep' ? 25 : 0;

    const monthly = basePrice + sourceCost + contentTypeCost + analysisCost;
    const annual = monthly * 12 * 0.75;

    return { monthly, annual };
  };

  const handleNext = async () => {
    if (currentStep < 7) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
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
        if (data) sourcesData.push(data[0]);
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
          ...selectedTopics.map(t => ({ topic: t, tags: [] })),
          ...competitors.map(c => ({ topic: c, tags: ['Competitor'] }))
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
    setSelectedSources((prev) =>
      prev.find((s) => s.url === source.url)
        ? prev.filter((s) => s.url !== source.url)
        : [...prev, source]
    );
  };

  const addCustomSource = () => {
    if (customSource.name.trim() && customSource.url.trim()) {
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className="flex-1 flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all ${
                    step < currentStep
                      ? 'bg-green-500 text-white'
                      : step === currentStep
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < currentStep ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 7 && (
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
            <span className="text-center">Location</span>
            <span className="text-center">Topics</span>
            <span className="text-center">Sources</span>
            <span className="text-center">Content</span>
            <span className="text-center">Config</span>
            <span className="text-center">Review</span>
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about this business</h2>
                <p className="text-gray-600">Help us understand what this company does so we can suggest relevant monitoring topics</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  placeholder="Acme Inc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Description</label>
                <textarea
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                  placeholder="What does this company do?"
                />
                <p className="mt-2 text-xs text-blue-600 font-medium">
                  Tip: The more detail you provide, the more tailored and relevant your results will be. Include specifics about products, services, and target market.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                >
                  <option value="">Select industry</option>
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Help us tailor your monitoring</h2>
                <p className="text-gray-600">Geographic focus and business context help us find the most relevant sources</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Why location matters:</strong> AI uses this to filter geographically relevant sources, exclude irrelevant jurisdictions, and find region-specific opportunities.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Geographic Focus</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Country/Region</label>
                    <input
                      type="text"
                      value={locationCountry}
                      onChange={(e) => setLocationCountry(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g., Canada"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Province/State</label>
                    <input
                      type="text"
                      value={locationProvince}
                      onChange={(e) => setLocationProvince(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g., British Columbia"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">City/Local</label>
                    <input
                      type="text"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      placeholder="e.g., Vancouver"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 italic">Example: "Vancouver, BC, Canada" ensures you get local updates, not just national news</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Business Context</label>
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
            </div>
          )}

          {currentStep === 3 && (
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
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Analyzing the business...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                {suggestedTopics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => toggleTopic(topic)}
                    className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                      selectedTopics.includes(topic)
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{topic}</span>
                      {selectedTopics.includes(topic) && <Check className="w-5 h-5 text-blue-600" />}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Custom Topic</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomTopic()}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
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
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm"
                        >
                          {topic}
                          <button onClick={() => toggleTopic(topic)} className="hover:text-blue-600">
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

          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Where should we monitor?</h2>
                <p className="text-gray-600">
                  {aiLoading ? 'AI is finding authoritative sources...' : 'Select relevant sources for your topics'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center mt-0.5">
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-900 mb-2">Comprehensive Monitoring Approach</p>
                    <p className="text-sm text-blue-800 mb-3">
                      We use a dual monitoring strategy to ensure you never miss important updates:
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                        <p className="text-sm text-blue-800">
                          <strong>Source Monitoring:</strong> Each source you select will be actively tracked for new content and changes, with updates delivered to your dashboard as soon as they're published.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0"></div>
                        <p className="text-sm text-blue-800">
                          <strong>AI Web Scanning:</strong> Our AI continuously searches the broader internet for relevant updates beyond your monitored sources, ensuring comprehensive topic coverage.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">Source Monitoring Cost</span>
                    <span className="text-sm font-bold text-blue-600">$3 per source/month</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    AI web scanning is included at no additional cost
                  </p>
                </div>
              </div>

              {aiLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                    We couldn't find specific sources that publish regular updates for your topics. That's okay - our AI will continuously scan the entire web to find the most relevant and recent updates for this business.
                  </p>
                  <div className="bg-white rounded-lg p-4 text-left max-w-md mx-auto mb-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">What this means:</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>✓ Comprehensive AI-powered web scanning</li>
                      <li>✓ Updates delivered to your dashboard in real-time</li>
                      <li>✓ No additional source monitoring costs</li>
                      <li>✓ All relevant content filtered to this business</li>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add a Custom Source</label>
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
                    onClick={() => toggleSource(source)}
                    className={`w-full px-4 py-4 rounded-lg border-2 text-left transition-all ${
                      isSelected
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
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                            $3/mo
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
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        {selectedSources.length} {selectedSources.length === 1 ? 'source' : 'sources'} selected
                      </p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Active monitoring + timely updates to your dashboard
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        ${selectedSources.length * 3}/mo
                      </p>
                      <p className="text-xs text-blue-700">source monitoring</p>
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
                  <input
                    type="text"
                    value={customSource.description}
                    onChange={(e) => setCustomSource({ ...customSource, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="Brief description"
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
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          selectedContentTypes.includes(type.id)
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{type.label}</span>
                            {selectedContentTypes.includes(type.id) && (
                              <Check className="w-5 h-5 text-blue-600" />
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure your monitoring</h2>
                <p className="text-gray-600">Customize how and when you receive updates</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Update Frequency</label>
                  <div className="space-y-2">
                    {(['weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => setFrequency(freq)}
                        className={`w-full px-4 py-3 rounded-lg border-2 font-medium transition-all capitalize text-left ${
                          frequency === freq
                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="capitalize">{freq === 'biweekly' ? 'Bi-Weekly' : freq}</span>
                          <span className="text-sm font-semibold">${{ weekly: 69, biweekly: 49, monthly: 29 }[freq]}/mo base</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">AI Analysis Depth</label>
                  <div className="space-y-2">
                    {(['standard', 'deep'] as const).map((depth) => (
                      <button
                        key={depth}
                        onClick={() => setAnalysisDepth(depth)}
                        className={`w-full px-4 py-3 rounded-lg border-2 font-medium transition-all capitalize text-left ${
                          analysisDepth === depth
                            ? 'border-blue-600 bg-blue-50 text-blue-900'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{depth}</span>
                          <span className="text-sm font-semibold">{depth === 'standard' ? 'Included' : '+$25/mo'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Competitor Tracking</label>
                <p className="text-sm text-gray-600 mb-3">
                  Track mentions of competitors across all sources. We'll alert you when competitors make announcements, launch products, or appear in news coverage.
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={competitorInput}
                    onChange={(e) => setCompetitorInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCompetitor()}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="Competitor name or website"
                  />
                  <button
                    onClick={addCompetitor}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {competitors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {competitors.map((competitor, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-900 rounded-full text-sm"
                      >
                        {competitor}
                        <button onClick={() => removeCompetitor(index)} className="hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Keyword Alerts</label>
                <p className="text-sm text-gray-600 mb-3">
                  Get notified whenever specific phrases appear in updates. Perfect for tracking regulatory terms, product names, or critical issues relevant to this business.
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="e.g., carbon tax, GDPR, new regulations"
                  />
                  <button
                    onClick={addKeyword}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-900 rounded-full text-sm"
                      >
                        {keyword}
                        <button onClick={() => removeKeyword(index)} className="hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Results Per Scan: <span className="text-blue-600 font-semibold">{resultsPerScan}</span>
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Choose how many of the most relevant articles you want per scan. Higher numbers may take longer but provide more comprehensive coverage.
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {[5, 10, 20, 50].map((count) => (
                    <button
                      key={count}
                      onClick={() => setResultsPerScan(count)}
                      className={`px-4 py-3 rounded-lg border-2 font-medium transition-all text-center ${
                        resultsPerScan === count
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Top {count}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Recommended: 10-20 articles for most businesses</p>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Review & Confirm</h2>
                <p className="text-gray-600">Confirm your selections and understand the billing</p>
              </div>

              <div className="bg-red-50 border-2 border-red-300 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-900 mb-2">Important Billing Notice</h3>
                    <p className="text-sm text-red-800 mb-4">
                      By adding this company, you will be charged an additional subscription fee. Each company you monitor has its own separate subscription with its own pricing based on your configuration choices.
                    </p>
                    <div className="bg-white rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold text-gray-900 mb-2">You will be charged:</p>
                      <div className="text-2xl font-bold text-red-600 mb-1">
                        ${pricing.monthly}/month
                      </div>
                      <p className="text-xs text-gray-600">for {companyName}</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billingAcknowledged}
                        onChange={(e) => setBillingAcknowledged(e.target.checked)}
                        className="mt-0.5 h-5 w-5 text-red-600 border-gray-300 rounded focus:ring-2 focus:ring-red-500"
                      />
                      <span className="text-sm text-red-900 font-medium">
                        I understand that I will be billed ${pricing.monthly}/month for this company in addition to any other companies I'm monitoring.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Business Profile</h3>
                    <p className="text-sm text-gray-600">{companyName}</p>
                    <p className="text-sm text-gray-600">{industry}</p>
                    {(locationCity || locationProvince || locationCountry) && (
                      <p className="text-sm text-gray-600 mt-1">
                        {[locationCity, locationProvince, locationCountry].filter(Boolean).join(', ')}
                      </p>
                    )}
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
                    <h3 className="font-semibold text-gray-900 mb-2">Sources ({selectedSources.length})</h3>
                    <div className="space-y-1">
                      {selectedSources.slice(0, 3).map((source) => (
                        <p key={source.url} className="text-sm text-gray-600">
                          {source.name}
                        </p>
                      ))}
                      {selectedSources.length > 3 && (
                        <p className="text-sm text-gray-500">+{selectedSources.length - 3} more</p>
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
                    <p className="text-sm text-gray-600 capitalize">Frequency: {frequency}</p>
                    <p className="text-sm text-gray-600 capitalize">Analysis: {analysisDepth}</p>
                    <p className="text-sm text-gray-600">Delivery: Dashboard</p>
                    <p className="text-sm text-gray-600">First scan: Immediately after setup</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6">
                  <div className="flex items-center justify-center w-12 h-12 bg-white rounded-xl mb-4">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Cost Breakdown</h3>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Base ({frequency === 'biweekly' ? 'Bi-Weekly' : frequency})</span>
                      <span className="font-semibold">${{ weekly: 69, biweekly: 49, monthly: 29 }[frequency]}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{selectedSources.length} sources</span>
                      <span className="font-semibold">${selectedSources.length * 3}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{selectedContentTypes.length} content types</span>
                      <span className="font-semibold">${selectedContentTypes.length * 5}</span>
                    </div>
                    {analysisDepth === 'deep' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Deep analysis</span>
                        <span className="font-semibold">$25</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Dashboard delivery</span>
                      <span>Included</span>
                    </div>
                  </div>

                  <div className="border-t border-blue-200 pt-4 mb-4">
                    <button
                      onClick={() => setShowAnnual(!showAnnual)}
                      className="flex items-center justify-between w-full text-sm mb-2"
                    >
                      <span className="text-gray-600">Billing</span>
                      <span className="text-blue-600 font-medium">
                        {showAnnual ? 'Annual' : 'Monthly'}
                      </span>
                    </button>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold text-gray-900">
                        ${showAnnual ? pricing.annual.toFixed(0) : pricing.monthly.toFixed(0)}
                      </span>
                      <span className="text-gray-600">
                        /{showAnnual ? 'year' : 'month'}
                      </span>
                    </div>
                    {showAnnual && (
                      <p className="text-xs text-green-600 mt-1">Save 25% with annual billing</p>
                    )}
                  </div>

                  <button
                    onClick={() => setShowAnnual(!showAnnual)}
                    className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Switch to {showAnnual ? 'monthly' : 'annual'} billing
                  </button>
                </div>
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

          {currentStep < 7 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Saving...' : 'Continue'}
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading || !billingAcknowledged}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? 'Adding Company...' : 'Add Company & Start Monitoring'}
              <Check className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

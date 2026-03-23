import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Topic, Source, Competitor, Keyword, Subscription } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, Save, Plus, X, Loader, Sparkles, AlertCircle, HelpCircle, Building2, Trash2, Mail, MessageSquare, Send
} from 'lucide-react';
import { getTopicSuggestionsFromAI, getSourceSuggestionsFromAI } from '../utils/perplexity';
import { generateCompetitorSuggestions, discoverCompetitorUrls } from '../utils/openai';
import { calculatePricing, PricingConfig } from '../utils/pricing';
import CompanySwitcher from '../components/CompanySwitcher';

const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

export default function Settings() {
  const { profile, currentCompany, companies, refreshProfile, switchCompany, addCompany, signOut, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [monitoringGoals, setMonitoringGoals] = useState<string[]>([]);

  const [locationCountry, setLocationCountry] = useState('');
  const [locationProvince, setLocationProvince] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [businessContext, setBusinessContext] = useState<string[]>([]);

  const [sourceRecommendations, setSourceRecommendations] = useState<Array<{
    name: string;
    url: string;
    description: string;
    relevance_score: number;
    reasoning: string;
  }>>([]);
  const [generatingRecommendations, setGeneratingRecommendations] = useState(false);

  const MONITORING_GOALS = [
    'Industry trends and market changes',
    'Regulatory and compliance updates',
    'Competitor activity and announcements',
    'Technology and innovation developments',
    'Policy and legislation changes',
    'Grant and funding opportunities',
    'Economic indicators and forecasts',
    'Customer sentiment and feedback',
    'Supply chain and logistics updates',
    'M&A activity and partnerships',
  ];

  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState('');

  const [contentTypes, setContentTypes] = useState<string[]>([]);

  const [sources, setSources] = useState<Source[]>([]);
  const [newSource, setNewSource] = useState({ name: '', url: '', description: '' });

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [frequency, setFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('biweekly');
  const [resultsPerScan, setResultsPerScan] = useState(10);
  const [analysisDepth, setAnalysisDepth] = useState<'standard' | 'deep'>('standard');

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [newCompetitor, setNewCompetitor] = useState('');

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState('');

  const [pricingChanged, setPricingChanged] = useState(false);
  const [originalPrice, setOriginalPrice] = useState(0);

  const [deliveryPreferences, setDeliveryPreferences] = useState<{
    methods: string[];
    email_address: string | null;
    slack_webhook: string | null;
    teams_webhook: string | null;
    custom_webhook: string | null;
  }>({
    methods: ['dashboard'],
    email_address: null,
    slack_webhook: null,
    teams_webhook: null,
    custom_webhook: null,
  });

  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [sourceSuggestions, setSourceSuggestions] = useState<Array<{
    name: string;
    url: string;
    description: string;
    rssFeedUrl?: string;
  }>>([]);

  const contentTypeOptions = [
    { id: 'news', label: 'News Articles' },
    { id: 'legislation', label: 'Legislation & Regulations' },
    { id: 'grants', label: 'Grant Opportunities' },
    { id: 'reports', label: 'Industry Reports' },
    { id: 'press', label: 'Press Releases' },
    { id: 'government', label: 'Government Updates' },
    { id: 'competitor', label: 'Competitor News' },
  ];

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadData();
    }
  }, [profile?.id, authLoading]);

  const loadData = async () => {
    if (!profile?.id) return;

    try {
      const [topicsRes, sourcesRes, subscriptionRes, competitorsRes, keywordsRes] = await Promise.all([
        supabase.from('topics').select('*').eq('profile_id', profile.id),
        supabase.from('sources').select('*').eq('profile_id', profile.id),
        supabase.from('subscriptions').select('*').eq('profile_id', profile.id).maybeSingle(),
        supabase.from('competitors').select('*').eq('profile_id', profile.id),
        supabase.from('keywords').select('*').eq('profile_id', profile.id),
      ]);

      setCompanyName(profile.company_name || '');
      setIndustry(profile.industry || '');
      setBusinessDescription(profile.business_description || '');
      const goals = profile.monitoring_goals ? profile.monitoring_goals.split(', ').filter(Boolean) : [];
      setMonitoringGoals(goals);
      setContentTypes(profile.content_types || []);
      setResultsPerScan(profile.results_per_scan || 10);
      setAnalysisDepth(profile.analysis_depth || 'standard');

      setLocationCountry(profile.location_country || '');
      setLocationProvince(profile.location_province || '');
      setLocationCity(profile.location_city || '');
      setBusinessContext(profile.business_context || []);

      if (profile.delivery_preferences) {
        setDeliveryPreferences(profile.delivery_preferences as any);
      }

      setTopics(topicsRes.data || []);
      setSources(sourcesRes.data || []);
      setCompetitors(competitorsRes.data || []);
      setKeywords(keywordsRes.data || []);

      if (subscriptionRes.data) {
        setSubscription(subscriptionRes.data);
        setFrequency(subscriptionRes.data.frequency);
        setOriginalPrice(subscriptionRes.data.monthly_price);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const getCurrentPricing = () => {
    const config: PricingConfig = {
      frequency,
      sourceCount: sources.length,
      contentTypeCount: contentTypes.length,
      deliveryMethod: 'dashboard',
      deepAnalysis: false,
    };
    return calculatePricing(config);
  };

  useEffect(() => {
    if (!loading) {
      const currentPrice = getCurrentPricing().monthlyTotal;
      setPricingChanged(currentPrice !== originalPrice);
    }
  }, [frequency, sources.length, contentTypes.length, loading]);

  const handleGetTopicSuggestions = async () => {
    setAiLoading(true);
    try {
      const suggestions = await getTopicSuggestionsFromAI(businessDescription, industry);
      if (suggestions && suggestions.length > 0) {
        const filteredSuggestions = suggestions
          .slice(0, 8)
          .filter(topic => !topics.find(t => t.topic_name.toLowerCase() === topic.toLowerCase()));
        setTopicSuggestions(filteredSuggestions);
      }
    } catch (error) {
      console.error('Error getting topic suggestions:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const addTopicSuggestion = async (topicName: string) => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from('topics')
        .insert({ profile_id: profile.id, topic_name: topicName, is_custom: false })
        .select()
        .single();
      if (data) {
        setTopics(prev => [...prev, data]);
        setTopicSuggestions(prev => prev.filter(t => t !== topicName));
      }
    } catch (error) {
      console.error('Error adding topic:', error);
    }
  };

  const handleGetSourceSuggestions = async () => {
    setAiLoading(true);
    try {
      const topicNames = topics.map(t => t.topic_name);
      const suggestions = await getSourceSuggestionsFromAI(topicNames, industry);
      if (suggestions && suggestions.length > 0) {
        const filteredSuggestions = suggestions
          .slice(0, 6)
          .filter(source => !sources.find(s => s.url.toLowerCase() === source.url.toLowerCase()));
        setSourceSuggestions(filteredSuggestions);
      }
    } catch (error) {
      console.error('Error getting source suggestions:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const addSourceSuggestion = async (source: { name: string; url: string; description: string; rssFeedUrl?: string }) => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase
        .from('sources')
        .insert({
          profile_id: profile.id,
          name: source.name,
          url: source.url,
          description: source.description,
          rss_feed_url: source.rssFeedUrl || '',
        })
        .select()
        .single();
      if (data) {
        setSources(prev => [...prev, data]);
        setSourceSuggestions(prev => prev.filter(s => s.url !== source.url));
      }
    } catch (error) {
      console.error('Error adding source:', error);
    }
  };

  const handleGenerateSourceRecommendations = async () => {
    setGeneratingRecommendations(true);
    try {
      const topicNames = topics.map(t => t.topic_name);

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-source-recommendations`;

      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          businessDescription,
          industry,
          monitoringGoals: monitoringGoals.join(', '),
          topics: topicNames,
          locationCountry,
          locationProvince,
          locationCity,
          businessContext,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed To Generate Recommendations');
      }

      const data = await response.json();
      const recommendations = data.sources || [];
      // Sort by relevance score, highest to lowest
      const sortedRecommendations = recommendations.sort((a: any, b: any) => b.relevance_score - a.relevance_score);
      setSourceRecommendations(sortedRecommendations);
    } catch (error) {
      console.error('Error generating source recommendations:', error);
      alert('Failed To Generate Source Recommendations. Please Try Again.');
    } finally {
      setGeneratingRecommendations(false);
    }
  };

  const addRecommendedSource = async (recommendation: typeof sourceRecommendations[0]) => {
    if (!profile?.id) return;

    try {
      const exists = sources.find(s => s.url.toLowerCase() === recommendation.url.toLowerCase());
      if (exists) {
        alert('This Source Is Already Added');
        return;
      }

      const { data } = await supabase
        .from('sources')
        .insert({
          profile_id: profile.id,
          name: recommendation.name,
          url: recommendation.url,
          is_core_source: true,
          description: recommendation.description,
          relevance_score: recommendation.relevance_score,
        })
        .select()
        .single();

      if (data) {
        setSources(prev => [...prev, data]);
        alert('Source Added Successfully!');
      }
    } catch (error) {
      console.error('Error adding recommended source:', error);
      alert('Failed To Add Source. Please Try Again.');
    }
  };

  const addTopic = async () => {
    if (!newTopic.trim() || !profile?.id) return;

    try {
      const { data } = await supabase
        .from('topics')
        .insert({ profile_id: profile.id, topic_name: newTopic.trim(), is_custom: true })
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

  const removeTopic = async (id: string) => {
    try {
      await supabase.from('topics').delete().eq('id', id);
      setTopics(topics.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error removing topic:', error);
    }
  };

  const toggleContentType = (typeId: string) => {
    setContentTypes(prev =>
      prev.includes(typeId)
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  const addSource = async () => {
    if (!newSource.name.trim() || !newSource.url.trim() || !profile?.id) return;

    try {
      const { data } = await supabase
        .from('sources')
        .insert({
          profile_id: profile.id,
          name: newSource.name.trim(),
          url: newSource.url.trim(),
          description: newSource.description.trim(),
          is_core_source: true,
        })
        .select()
        .single();

      if (data) {
        setSources([...sources, data]);
        setNewSource({ name: '', url: '', description: '' });
      }
    } catch (error) {
      console.error('Error adding source:', error);
    }
  };

  const removeSource = async (id: string) => {
    try {
      await supabase.from('sources').delete().eq('id', id);
      setSources(sources.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error removing source:', error);
    }
  };

  const addCompetitor = async () => {
    if (!newCompetitor.trim() || !profile?.id) return;

    setAiLoading(true);
    try {
      const urls = await discoverCompetitorUrls(newCompetitor.trim(), industry);

      const { data } = await supabase
        .from('competitors')
        .insert({
          profile_id: profile.id,
          name: urls?.name || newCompetitor.trim(),
          url: urls?.urls.website || '',
        })
        .select()
        .single();

      if (data) {
        setCompetitors([...competitors, data]);
        setNewCompetitor('');
      }
    } catch (error) {
      console.error('Error adding competitor:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const removeCompetitor = async (id: string) => {
    try {
      await supabase.from('competitors').delete().eq('id', id);
      setCompetitors(competitors.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error removing competitor:', error);
    }
  };

  const addKeyword = async () => {
    if (!newKeyword.trim() || !profile?.id) return;

    try {
      const { data } = await supabase
        .from('keywords')
        .insert({ profile_id: profile.id, keyword: newKeyword.trim() })
        .select()
        .single();

      if (data) {
        setKeywords([...keywords, data]);
        setNewKeyword('');
      }
    } catch (error) {
      console.error('Error adding keyword:', error);
    }
  };

  const removeKeyword = async (id: string) => {
    try {
      await supabase.from('keywords').delete().eq('id', id);
      setKeywords(keywords.filter(k => k.id !== id));
    } catch (error) {
      console.error('Error removing keyword:', error);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({
          company_name: companyName,
          industry,
          business_description: businessDescription,
          monitoring_goals: monitoringGoals.join(', '),
          content_types: contentTypes,
          results_per_scan: resultsPerScan,
          analysis_depth: analysisDepth,
          location_country: locationCountry,
          location_province: locationProvince,
          location_city: locationCity,
          business_context: businessContext,
          delivery_preferences: deliveryPreferences,
        })
        .eq('id', profile.id);

      const pricing = getCurrentPricing();

      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({
            frequency,
            delivery_method: 'dashboard',
            monthly_price: pricing.monthlyTotal,
            annual_price: pricing.annualTotal,
          })
          .eq('id', subscription.id);
      } else {
        await supabase
          .from('subscriptions')
          .insert({
            profile_id: profile.id,
            frequency,
            delivery_method: 'dashboard',
            monthly_price: pricing.monthlyTotal,
            annual_price: pricing.annualTotal,
          });
      }

      await refreshProfile();
      setOriginalPrice(pricing.monthlyTotal);
      setPricingChanged(false);

      alert('Settings saved successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!profile) {
    navigate('/login');
    return null;
  }

  const pricing = getCurrentPricing();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-5xl mx-auto p-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="flex items-center gap-3 mb-8">
          <Activity className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Companies Management */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Your Companies</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Manage multiple companies (${calculatePricing({ frequency: subscription?.frequency || 'monthly', sourceCount: sources.length, contentTypeCount: contentTypes.length, deliveryMethod: 'dashboard', deepAnalysis: false }).basePrice}/month per company)
                </p>
              </div>
              <CompanySwitcher />
            </div>

            <div className="space-y-3">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    company.id === currentCompany?.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-900">{company.name}</h3>
                        {company.id === currentCompany?.id && (
                          <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Active</span>
                        )}
                      </div>
                      {company.industry && (
                        <p className="text-sm text-gray-600">{company.industry}</p>
                      )}
                      {company.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{company.description}</p>
                      )}
                    </div>
                    {companies.length > 1 && company.id !== currentCompany?.id && (
                      <button
                        onClick={() => switchCompany(company.id)}
                        className="ml-4 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">Total Monthly Cost</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(calculatePricing({ frequency: subscription?.frequency || 'monthly', sourceCount: sources.length, contentTypeCount: contentTypes.length, deliveryMethod: 'dashboard', deepAnalysis: false }).basePrice * companies.length).toFixed(2)}
                    <span className="text-base font-normal text-gray-600">/month</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {companies.length} {companies.length === 1 ? 'company' : 'companies'} × ${calculatePricing({ frequency: subscription?.frequency || 'monthly', sourceCount: sources.length, contentTypeCount: contentTypes.length, deliveryMethod: 'dashboard', deepAnalysis: false }).basePrice}/month
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Company Profile */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Current Company Profile</h2>
            <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-900">{currentCompany?.name || 'No company selected'}</span>
              </div>
              {currentCompany?.industry && (
                <div>
                  <span className="text-xs font-medium text-gray-600">Industry:</span>
                  <span className="text-xs text-gray-900 ml-2">{currentCompany.industry}</span>
                </div>
              )}
            </div>
          </div>

          {/* Business Profile */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Company information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Description</label>
                <textarea
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-2 text-xs text-blue-600 font-medium">
                  Tip: The more detail you provide, the more tailored and relevant your results will be. Include specifics about your products, services, and target market.
                </p>
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

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">Geographic Focus (optional)</label>
                <p className="text-xs text-gray-500 mb-3">Help AI find geographically relevant sources and filter updates by location</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Country/Region</label>
                    <input
                      type="text"
                      value={locationCountry}
                      onChange={(e) => setLocationCountry(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Canada"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Province/State</label>
                    <input
                      type="text"
                      value={locationProvince}
                      onChange={(e) => setLocationProvince(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., British Columbia"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">City/Local</label>
                    <input
                      type="text"
                      value={locationCity}
                      onChange={(e) => setLocationCity(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Vancouver"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
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
            </div>
          </div>

          {/* AI Source Recommendations */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">AI source recommendations</h2>
                <p className="text-sm text-gray-600 mt-1">Get custom AI-powered source recommendations based on your business profile</p>
              </div>
              <button
                onClick={handleGenerateSourceRecommendations}
                disabled={generatingRecommendations || !businessDescription || !industry}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                {generatingRecommendations ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generatingRecommendations ? 'Generating...' : 'Generate recommendations'}
              </button>
            </div>

{sourceRecommendations.length > 0 ? (
              <div className="space-y-3">
                {sourceRecommendations.map((rec, index) => {
                  // Determine color based on score
                  const getScoreStyle = (score: number) => {
                    if (score >= 8) {
                      // Green gradient for 8-10
                      return {
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        borderColor: '#059669'
                      };
                    } else if (score >= 3) {
                      // Orange gradient for 3-7
                      return {
                        background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
                        color: 'white',
                        borderColor: '#ea580c'
                      };
                    } else {
                      // Red gradient for 0-3
                      return {
                        background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
                        color: 'white',
                        borderColor: '#dc2626'
                      };
                    }
                  };

                  const scoreStyle = getScoreStyle(rec.relevance_score);

                  return (
                    <div key={index} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg mb-1">{rec.name}</h3>
                          <a
                            href={rec.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline block mb-2"
                          >
                            {rec.url}
                          </a>
                          <p className="text-sm text-gray-700 mb-2">{rec.description}</p>
                          <p className="text-xs text-gray-600 italic">{rec.reasoning}</p>
                        </div>
                        <div className="flex flex-col items-end gap-3 flex-shrink-0">
                          <div
                            style={{
                              background: scoreStyle.background,
                              color: scoreStyle.color,
                              borderColor: scoreStyle.borderColor
                            }}
                            className="px-4 py-2 rounded-lg font-bold text-lg shadow-md border-2 min-w-[80px] text-center"
                          >
                            {rec.relevance_score}/10
                          </div>
                          <button
                            onClick={() => addRecommendedSource(rec)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                          >
                            Add source
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Click "Generate recommendations" to get AI-powered source suggestions</p>
              </div>
            )}
          </div>

          {/* Topics */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Topics you monitor</h2>
              <button
                onClick={handleGetTopicSuggestions}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                AI suggestions
              </button>
            </div>

            {/* AI Suggestions */}
            {topicSuggestions.length > 0 && (
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-gray-900">AI Suggested Topics</h3>
                </div>
                <div className="space-y-2">
                  {topicSuggestions.map((topic, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-purple-200">
                      <span className="text-gray-900">{topic}</span>
                      <button
                        onClick={() => addTopicSuggestion(topic)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {topics.map(topic => (
                <div key={topic.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-900">{topic.topic_name}</span>
                  <button
                    onClick={() => removeTopic(topic.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTopic()}
                placeholder="Add new topic..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addTopic}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Types */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Content types</h2>
            <div className="grid grid-cols-2 gap-3">
              {contentTypeOptions.map(type => (
                <label
                  key={type.id}
                  className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300"
                  style={{
                    borderColor: contentTypes.includes(type.id) ? '#3b82f6' : '#e5e7eb',
                    backgroundColor: contentTypes.includes(type.id) ? '#eff6ff' : 'white'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={contentTypes.includes(type.id)}
                    onChange={() => toggleContentType(type.id)}
                    className="w-5 h-5"
                  />
                  <span className="font-medium text-gray-900">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Monitored Sources ({sources.length})</h2>
              <button
                onClick={handleGetSourceSuggestions}
                disabled={aiLoading || topics.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                Suggest Sources
              </button>
            </div>

            {/* AI Suggestions */}
            {sourceSuggestions.length > 0 && (
              <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-gray-900">AI Suggested Sources</h3>
                </div>
                <div className="space-y-2">
                  {sourceSuggestions.map((source, index) => (
                    <div key={index} className="flex items-start justify-between p-3 bg-white rounded-lg border border-purple-200">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-medium text-gray-900">{source.name}</p>
                        <p className="text-sm text-gray-600 truncate">{source.url}</p>
                        {source.description && (
                          <p className="text-xs text-gray-500 mt-1">{source.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => addSourceSuggestion(source)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex-shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {sources.map(source => (
                <div key={source.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{source.name}</p>
                    <p className="text-sm text-gray-600">{source.url}</p>
                  </div>
                  <button
                    onClick={() => removeSource(source.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                placeholder="Source name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="url"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addSource}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Add Custom Source
              </button>
            </div>
          </div>

          {/* Update Configuration */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Update Configuration</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Update Frequency</label>
                <p className="text-sm text-gray-600 mb-3">
                  Choose how often you want to receive updates. This setting does not affect pricing.
                </p>
                <div className="space-y-2">
                  {(['weekly', 'biweekly', 'monthly'] as const).map(freq => (
                    <label
                      key={freq}
                      className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300"
                      style={{
                        borderColor: frequency === freq ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: frequency === freq ? '#eff6ff' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        checked={frequency === freq}
                        onChange={() => setFrequency(freq)}
                        className="w-5 h-5"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">
                          {freq === 'biweekly' ? 'Bi-Weekly' : freq === 'weekly' ? 'Weekly' : 'Monthly'} Updates
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">AI Analysis Depth</label>
                <p className="text-sm text-gray-600 mb-3">
                  Choose how deeply the AI analyzes each update for relevance and insights.
                </p>
                <div className="space-y-2">
                  {(['standard', 'deep'] as const).map(depth => (
                    <label
                      key={depth}
                      className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-300"
                      style={{
                        borderColor: analysisDepth === depth ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: analysisDepth === depth ? '#eff6ff' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        checked={analysisDepth === depth}
                        onChange={() => setAnalysisDepth(depth)}
                        className="w-5 h-5"
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="font-medium text-gray-900 capitalize">
                          {depth} Analysis
                        </span>
                        <span className="text-sm font-semibold text-gray-600">
                          {depth === 'standard' ? 'Included' : '+$25/mo'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Results Per Scan: <span className="text-blue-600 font-semibold">{resultsPerScan}</span>
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Choose how many of the most relevant articles you want per scan. We rank all results by relevance and deliver the top results to you.
                </p>
                <div className="grid grid-cols-4 gap-3">
                  {[5, 10, 20, 50].map((count) => (
                    <button
                      key={count}
                      onClick={() => {
                        setResultsPerScan(count);
                        setPricingChanged(true);
                      }}
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
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <span className="font-semibold">Recommended: 5 results</span>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    More results increases the chance that some may not be highly relevant to your business goals.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Competitors */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Competitors Monitored</h2>

            <div className="space-y-2 mb-4">
              {competitors.map(comp => (
                <div key={comp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{comp.name}</p>
                    {comp.url && <p className="text-sm text-gray-600">{comp.url}</p>}
                  </div>
                  <button
                    onClick={() => removeCompetitor(comp.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCompetitor()}
                placeholder="Competitor name (AI will find URLs)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addCompetitor}
                disabled={aiLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {aiLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Delivery Preferences - Enterprise Only */}
          {subscription?.tier === 'enterprise' && (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Delivery Preferences</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure how you receive your updates</p>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Enterprise Feature</p>
                    <p className="text-sm text-blue-800">
                      Custom delivery methods are available exclusively to Enterprise customers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Delivery Methods</label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 border-2 border-gray-300 bg-gray-50 rounded-lg cursor-not-allowed opacity-60">
                      <input
                        type="checkbox"
                        checked={deliveryPreferences.methods.includes('dashboard')}
                        disabled
                        className="mt-0.5 h-5 w-5 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-gray-900">Dashboard</span>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">Active</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">View updates directly in your dashboard (always enabled)</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 rounded-lg hover:border-blue-300 cursor-pointer transition-all"
                      style={{
                        borderColor: deliveryPreferences.methods.includes('email') ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: deliveryPreferences.methods.includes('email') ? '#eff6ff' : 'white'
                      }}>
                      <input
                        type="checkbox"
                        checked={deliveryPreferences.methods.includes('email')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDeliveryPreferences({
                              ...deliveryPreferences,
                              methods: [...deliveryPreferences.methods.filter(m => m !== 'email'), 'email']
                            });
                          } else {
                            setDeliveryPreferences({
                              ...deliveryPreferences,
                              methods: deliveryPreferences.methods.filter(m => m !== 'email'),
                              email_address: null
                            });
                          }
                        }}
                        className="mt-0.5 h-5 w-5 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-gray-900">Email Delivery</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Receive digest emails with your updates</p>
                      </div>
                    </label>

                    {deliveryPreferences.methods.includes('email') && (
                      <div className="ml-11 mb-3">
                        <input
                          type="email"
                          value={deliveryPreferences.email_address || ''}
                          onChange={(e) => setDeliveryPreferences({
                            ...deliveryPreferences,
                            email_address: e.target.value
                          })}
                          placeholder="Enter email address"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}

                    <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-not-allowed opacity-50">
                      <input
                        type="checkbox"
                        checked={deliveryPreferences.methods.includes('slack')}
                        disabled
                        className="mt-0.5 h-5 w-5 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-gray-900">Slack Integration</span>
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">Coming Soon</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Post updates to your Slack channels</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-not-allowed opacity-50">
                      <input
                        type="checkbox"
                        checked={deliveryPreferences.methods.includes('teams')}
                        disabled
                        className="mt-0.5 h-5 w-5 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-gray-900">Microsoft Teams</span>
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">Coming Soon</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Send updates to Microsoft Teams channels</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 rounded-lg hover:border-blue-300 cursor-pointer transition-all"
                      style={{
                        borderColor: deliveryPreferences.methods.includes('other') ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: deliveryPreferences.methods.includes('other') ? '#eff6ff' : 'white'
                      }}>
                      <input
                        type="checkbox"
                        checked={deliveryPreferences.methods.includes('other')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDeliveryPreferences({
                              ...deliveryPreferences,
                              methods: [...deliveryPreferences.methods.filter(m => m !== 'other'), 'other']
                            });
                          } else {
                            setDeliveryPreferences({
                              ...deliveryPreferences,
                              methods: deliveryPreferences.methods.filter(m => m !== 'other'),
                              custom_webhook: null
                            });
                          }
                        }}
                        className="mt-0.5 h-5 w-5 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Send className="w-4 h-4 text-gray-600" />
                          <span className="font-medium text-gray-900">Other</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Specify a custom delivery method</p>
                      </div>
                    </label>

                    {deliveryPreferences.methods.includes('other') && (
                      <div className="ml-11 mb-3">
                        <input
                          type="text"
                          value={deliveryPreferences.custom_webhook || ''}
                          onChange={(e) => setDeliveryPreferences({
                            ...deliveryPreferences,
                            custom_webhook: e.target.value
                          })}
                          placeholder="Describe your delivery method"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Keywords */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Keyword Alerts</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {keywords.map(keyword => (
                <span
                  key={keyword.id}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-900 rounded-full text-sm"
                >
                  {keyword.keyword}
                  <button
                    onClick={() => removeKeyword(keyword.id)}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                placeholder="e.g., acquisition, lawsuit, funding"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={addKeyword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold mb-2">Save Changes & Update Monitoring</h3>
                <p className="text-blue-100 text-sm">Changes take effect in next update cycle</p>
              </div>
              {pricingChanged && (
                <div className="flex items-center gap-2 bg-white/20 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Pricing Updated</span>
                </div>
              )}
            </div>

            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>New monthly cost:</span>
                <span className="font-bold text-lg">${pricing.monthlyTotal}</span>
              </div>
              {pricingChanged && (
                <div className="text-sm text-blue-100">
                  (Changed from: ${originalPrice})
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-6 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

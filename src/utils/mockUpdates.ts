import { supabase, Source } from '../lib/supabase';
import { generateMockUpdatesFromAI } from './perplexity';

type UpdateTemplate = {
  title: string;
  summary: string;
  relevanceScore: number;
  contentType?: string;
  originalUrl?: string;
};

const realEstateUpdates: UpdateTemplate[] = [
  {
    title: 'BC Government Announces New Rental Protection Measures',
    summary: 'The provincial government has introduced new regulations limiting rent increases to 3.5% annually. The measures also strengthen tenant rights during property sales and renovations.',
    relevanceScore: 9,
    contentType: 'legislation',
  },
  {
    title: 'Vancouver Housing Market Shows Slight Decline in Q4',
    summary: 'Recent data from the Real Estate Board shows a 2.3% decrease in average home prices. Industry experts attribute this to higher interest rates and stricter lending requirements.',
    relevanceScore: 7,
    contentType: 'market',
  },
  {
    title: 'New Strata Regulations Take Effect Next Month',
    summary: 'Property managers need to be aware of updated strata rules regarding emergency fund requirements and AGM procedures. Non-compliance penalties have increased significantly.',
    relevanceScore: 8,
    contentType: 'legislation',
  },
  {
    title: 'Property Tax Assessment Changes for Commercial Buildings',
    summary: 'Municipal authorities have revised property tax assessment methods for commercial properties. Changes may result in 5-8% increases for properties in downtown cores.',
    relevanceScore: 6,
    contentType: 'government',
  },
  {
    title: 'CMHC Releases Updated Rental Market Report',
    summary: 'Vacancy rates in Metro Vancouver dropped to 1.2%, the lowest in five years. Rental demand continues to outpace supply, with new construction not keeping up with population growth.',
    relevanceScore: 8,
    contentType: 'research',
  },
];

const legalUpdates: UpdateTemplate[] = [
  {
    title: 'Supreme Court Ruling Affects Employment Contract Enforcement',
    summary: 'A landmark decision clarifies the enforceability of non-compete clauses in employment contracts. Legal experts say this will impact how companies draft future agreements.',
    relevanceScore: 9,
    contentType: 'legislation',
  },
  {
    title: 'Law Society Updates Professional Conduct Guidelines',
    summary: 'New guidelines address client confidentiality in digital communications and social media use by practitioners. All members must complete the updated ethics training by year-end.',
    relevanceScore: 7,
    contentType: 'policy',
  },
  {
    title: 'Privacy Act Amendments Receive Royal Assent',
    summary: 'Significant changes to privacy legislation will require businesses to update their data handling practices. Compliance deadline set for six months from now.',
    relevanceScore: 8,
    contentType: 'legislation',
  },
  {
    title: 'BC Court of Appeal Clarifies Real Estate Disclosure Requirements',
    summary: 'Recent ruling establishes higher standards for property disclosure in residential transactions. Legal practitioners should review current disclosure practices.',
    relevanceScore: 6,
    contentType: 'legislation',
  },
  {
    title: 'New Class Action Certification Rules Announced',
    summary: 'Changes to certification procedures may make it easier for plaintiffs to pursue class action lawsuits. Defense attorneys should familiarize themselves with the new framework.',
    relevanceScore: 7,
    contentType: 'policy',
  },
];

const techUpdates: UpdateTemplate[] = [
  {
    title: 'OpenAI Releases GPT-5 with Enhanced Reasoning Capabilities',
    summary: 'The latest language model demonstrates significant improvements in logical reasoning and code generation. Early benchmarks show 40% better performance on complex tasks.',
    relevanceScore: 9,
    contentType: 'news',
  },
  {
    title: 'Critical Security Vulnerability Discovered in Popular Framework',
    summary: 'A severe vulnerability affecting millions of applications has been identified. Patches are available and immediate updating is strongly recommended for all users.',
    relevanceScore: 10,
    contentType: 'news',
  },
  {
    title: 'Cloud Computing Costs Expected to Rise 15% in 2026',
    summary: 'Major cloud providers have announced price increases citing infrastructure expansion costs. Companies should review their cloud spending and optimization strategies.',
    relevanceScore: 6,
    contentType: 'market',
  },
  {
    title: 'New Data Privacy Regulations Impact SaaS Providers',
    summary: 'Upcoming legislation will require stricter data residency controls and user consent mechanisms. Software companies have 90 days to implement compliance measures.',
    relevanceScore: 8,
    contentType: 'legislation',
  },
  {
    title: 'GitHub Introduces AI-Powered Code Review Features',
    summary: 'New tooling uses machine learning to identify bugs and suggest improvements during pull requests. Early adopters report 30% reduction in code review time.',
    relevanceScore: 7,
    contentType: 'technology',
  },
];

const generalUpdates: UpdateTemplate[] = [
  {
    title: 'Economic Forecast Predicts Moderate Growth for Next Quarter',
    summary: 'Leading economists project 2.5% GDP growth driven by consumer spending and business investment. Interest rate decisions expected to remain stable.',
    relevanceScore: 6,
    contentType: 'market',
  },
  {
    title: 'New Industry Standards Published for Data Security',
    summary: 'Professional body releases comprehensive security framework addressing modern threats. Organizations encouraged to audit current practices against new benchmarks.',
    relevanceScore: 7,
    contentType: 'policy',
  },
  {
    title: 'Government Consultation Opens on Regulatory Reform',
    summary: 'Public feedback sought on proposed changes to business regulations. Submission deadline is 60 days from announcement date.',
    relevanceScore: 5,
    contentType: 'government',
  },
  {
    title: 'Market Research Shows Shifting Consumer Preferences',
    summary: 'Recent survey data indicates growing demand for sustainable and ethical business practices. Companies adapting to these preferences seeing improved customer loyalty.',
    relevanceScore: 6,
    contentType: 'research',
  },
  {
    title: 'Professional Development: New Certification Program Announced',
    summary: 'Industry association launches updated certification program incorporating latest best practices and technologies. First cohort begins enrollment next month.',
    relevanceScore: 5,
    contentType: 'news',
  },
];

const getUpdatesForIndustry = (businessDescription: string, industry: string): UpdateTemplate[] => {
  const lowerDesc = businessDescription.toLowerCase();
  const lowerIndustry = industry.toLowerCase();

  if (lowerDesc.includes('property') || lowerDesc.includes('real estate') || lowerIndustry.includes('real estate')) {
    return realEstateUpdates;
  }

  if (lowerDesc.includes('law') || lowerDesc.includes('legal') || lowerIndustry.includes('legal')) {
    return legalUpdates;
  }

  if (lowerDesc.includes('tech') || lowerDesc.includes('software') || lowerIndustry.includes('technology')) {
    return techUpdates;
  }

  return generalUpdates;
};

const getRandomDate = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  return date.toISOString();
};

const calculateDateRange = (subscription: any) => {
  const now = new Date();
  const dateTo = now.toISOString().split('T')[0];
  let dateFrom: string;

  if (subscription?.last_update_delivered_at) {
    dateFrom = new Date(subscription.last_update_delivered_at).toISOString().split('T')[0];
  } else if (subscription?.first_update_date) {
    dateFrom = subscription.first_update_date;
  } else {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
  }

  return { dateFrom, dateTo };
};

export const generateMockUpdates = async (
  profileId: string,
  businessDescription: string,
  industry: string,
  sources: Source[],
  topics: string[] = [],
  contentTypes: string[] = []
) => {
  if (sources.length === 0) return;

  const existingUpdates = await supabase
    .from('updates')
    .select('id')
    .eq('profile_id', profileId);

  if (existingUpdates.data && existingUpdates.data.length > 0) {
    return;
  }

  const subscriptionRes = await supabase
    .from('watchdog_subscribers')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  const { dateFrom, dateTo } = calculateDateRange(subscriptionRes.data);

  let updatesToInsert: any[] = [];

  try {
    if (topics.length > 0 && contentTypes.length > 0) {
      const aiUpdates = await generateMockUpdatesFromAI(
        topics,
        sources.map((s) => ({ name: s.name, url: s.url })),
        contentTypes,
        businessDescription,
        dateFrom,
        dateTo
      );

      if (aiUpdates && aiUpdates.length > 0) {
        updatesToInsert = aiUpdates.map((u) => ({
          title: u.title,
          summary: u.summary,
          relevanceScore: u.relevanceScore,
          contentType: u.contentType,
          originalUrl: u.originalUrl,
          sourceName: u.sourceName,
          sourceUrl: u.sourceUrl,
          publishedDate: u.publishedDate,
        }));
      } else {
        throw new Error('No AI updates generated');
      }
    } else {
      throw new Error('Missing topics or content types');
    }
  } catch (error) {
    console.log('Using fallback curated updates', error);
    const fallbackUpdates = getUpdatesForIndustry(businessDescription, industry);
    updatesToInsert = fallbackUpdates.map((u) => ({
      ...u,
      sourceName: sources[0]?.name || 'Unknown',
      sourceUrl: sources[0]?.url || '',
      originalUrl: u.originalUrl || sources[0]?.url || '',
      publishedDate: getRandomDate(Math.floor(Math.random() * 7)),
    }));
  }

  const now = new Date();
  const batchLabel = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const deliveryBatch = `${batchLabel} Debrief`;

  for (let i = 0; i < updatesToInsert.length; i++) {
    const update = updatesToInsert[i];
    const source = sources.find(s => s.name === update.sourceName) || sources[i % sources.length];

    await supabase.from('updates').insert({
      profile_id: profileId,
      source_id: source.id,
      title: update.title,
      summary: update.summary,
      relevance_score: update.relevanceScore,
      source_name: update.sourceName || source.name,
      source_url: update.sourceUrl || source.url,
      original_url: update.originalUrl || source.url,
      content_type: update.contentType || 'news',
      published_at: update.publishedDate || getRandomDate(Math.floor(Math.random() * 7)),
      delivery_batch: deliveryBatch,
    });
  }

  if (subscriptionRes.data) {
    await supabase
      .from('watchdog_subscribers')
      .update({ last_update_delivered_at: new Date().toISOString() })
      .eq('id', subscriptionRes.data.id);
  }
};

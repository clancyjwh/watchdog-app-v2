


export const getTopicSuggestionsFromAI = async (
  businessDescription: string,
  industry: string
): Promise<string[] | null> => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-topics`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessDescription,
        industry,
      }),
    });

    if (!response.ok) {
      throw new Error(`Edge function error: ${response.status}`);
    }

    const data = await response.json();
    return data.topics || null;
  } catch (error) {
    console.error('Failed to get topic suggestions from AI:', error);
    return null;
  }
};

export type SourceSuggestion = {
  name: string;
  url: string;
  description: string;
  category?: string;
  rssFeedUrl?: string;
  relevanceScore?: number;
};

export const getSourceSuggestionsFromAI = async (
  topics: string[],
  industry: string,
  businessDescription: string = '',
  location: string = '',
  category?: string
): Promise<SourceSuggestion[] | null> => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-sources`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topics,
        industry,
        businessDescription,
        location,
        category,
      }),
    });

    if (!response.ok) {
      throw new Error(`Edge function error: ${response.status}`);
    }

    const data = await response.json();
    return data.sources || null;
  } catch (error) {
    console.error('Failed to get source suggestions from AI:', error);
    return null;
  }
};

export type UpdateSuggestion = {
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  originalUrl: string;
  contentType: string;
  relevanceScore: number;
  publishedDate: string;
};

export const fetchRealUpdatesFromPerplexity = async (
  topics: string[],
  sources: Array<{ name: string; url: string }>,
  contentTypes: string[],
  businessDescription: string = '',
  dateFrom?: string,
  dateTo?: string
): Promise<UpdateSuggestion[] | null> => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-perplexity-updates`;

    // Import supabase client dynamically to avoid circular dependencies
    const { supabase } = await import('../lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();

    const headers = {
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topics,
        sources,
        contentTypes,
        businessDescription,
        dateFrom,
        dateTo,
      }),
    });

    if (!response.ok) {
      throw new Error(`Edge function error: ${response.status}`);
    }

    const data = await response.json();

    if (data.updates && Array.isArray(data.updates)) {
      return data.updates.map((u: any) => ({
        title: u.title,
        summary: u.summary,
        sourceName: u.source_name,
        sourceUrl: u.source_url,
        originalUrl: u.original_url,
        contentType: u.content_type,
        relevanceScore: u.relevance_score,
        publishedDate: u.published_at,
      }));
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch real updates from Perplexity:', error);
    return null;
  }
};

export const generateMockUpdatesFromAI = async (
  topics: string[],
  sources: Array<{ name: string; url: string }>,
  contentTypes: string[],
  businessDescription: string = '',
  dateFrom?: string,
  dateTo?: string
): Promise<UpdateSuggestion[] | null> => {
  return fetchRealUpdatesFromPerplexity(topics, sources, contentTypes, businessDescription, dateFrom, dateTo);
};

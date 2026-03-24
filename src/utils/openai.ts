/**
 * Generates suggested topics via Make.com webhook
 */
export async function generateTopicSuggestions(
  businessDescription: string,
  industry: string,
  businessContext: string[] = []
): Promise<string[]> {
  const WEBHOOK_URL = 'https://hook.us2.make.com/f9mivoeldx87b02ty2xbqtk81jxb36km';

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessDescription,
        industry,
        businessContext: businessContext.join(', ')
      }),
    });

    if (!response.ok) {
      console.error('Make.com Topics Webhook error:', response.status);
      return [];
    }

    const data = await response.json();
    
    // Support the format: { "suggestedTopics": [ { "topic": "...", "why": "...", ... } ] }
    if (data.suggestedTopics && Array.isArray(data.suggestedTopics)) {
      return data.suggestedTopics.map((item: any) => item.topic);
    }

    // Fallback for simple array format
    if (Array.isArray(data)) {
      return data;
    }

    return [];
  } catch (error) {
    console.error('Error calling Topics Webhook:', error);
    return [];
  }
}

export type RelevanceResult = {
  score: number;
  reasoning: string;
};

export type CompetitorUrls = {
  name: string;
  urls: {
    website: string;
    blog: string;
    press: string;
    linkedin: string;
  };
};

async function callXAI(prompt: string, temperature: number = 0.3): Promise<string> {
  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature,
      }),
    });

    if (!response.ok) {
      console.error('xAI API error:', response.status, response.statusText);
      return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error calling xAI:', error);
    return '';
  }
}

export async function generateArticleBlurb(
  title: string,
  summary: string,
  sourceName: string
): Promise<string> {
  const prompt = `Given this article:

Title: ${title}
Source: ${sourceName}
Summary: ${summary}

Write one clear, descriptive sentence that explains what this article is about. Be concise and focus on the key information a reader would want to know. Return ONLY the sentence, no quotes or extra text.`;

  try {
    const response = await callXAI(prompt, 0.5);
    return response.trim() || summary;
  } catch (error) {
    console.error('Error generating article blurb:', error);
    return summary;
  }
}

export async function scoreArticleRelevance(
  articleTitle: string,
  articleContent: string,
  sourceName: string,
  userProfile: {
    businessDescription: string;
    topics: string[];
    contentTypes: string[];
  }
): Promise<RelevanceResult | null> {
  const prompt = `
User Profile:
- Business: ${userProfile.businessDescription}
- Topics: ${userProfile.topics.join(', ')}
- Content Types: ${userProfile.contentTypes.join(', ')}

Article:
Title: ${articleTitle}
Content: ${articleContent.substring(0, 2000)}
Source: ${sourceName}

Task: Rate this article's relevance to the user's interests on a scale of 1-10.
Consider topic alignment, content type match, and business relevance.
Return ONLY a JSON object: {"score": X, "reasoning": "brief explanation"}
`;

  try {
    const response = await callXAI(prompt, 0.3);
    if (!response) return null;

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: parsed.score || 5,
      reasoning: parsed.reasoning || 'Unable to determine relevance',
    };
  } catch (error) {
    console.error('Error scoring article relevance:', error);
    return null;
  }
}

export async function summarizeArticle(articleContent: string): Promise<string | null> {
  const prompt = `
Summarize this article in exactly 2-3 sentences for a busy professional.
Focus on key facts and actionable insights.

Article: ${articleContent.substring(0, 3000)}
`;

  try {
    const response = await callXAI(prompt, 0.5);
    return response || null;
  } catch (error) {
    console.error('Error summarizing article:', error);
    return null;
  }
}

export async function classifyContentType(
  articleTitle: string,
  articleContent: string
): Promise<string | null> {
  const prompt = `
Classify this article into ONE of these categories:
- news: Breaking news, current events, industry news
- legislation: Laws, regulations, policy changes, compliance
- grants: Grant opportunities, funding announcements, RFPs
- reports: Research papers, industry reports, white papers, studies
- press: Press releases, company announcements
- government: Government updates, official statements, public notices
- competitor: Competitor news, product launches, business moves

Article:
Title: ${articleTitle}
Content: ${articleContent.substring(0, 1500)}

Return ONLY the category name (e.g., "news" or "legislation"), nothing else.
`;

  try {
    const response = await callXAI(prompt, 0.2);
    const category = response.trim().toLowerCase();

    const validCategories = ['news', 'legislation', 'grants', 'reports', 'press', 'government', 'competitor'];
    if (validCategories.includes(category)) {
      return category;
    }

    return 'news';
  } catch (error) {
    console.error('Error classifying content type:', error);
    return null;
  }
}

export async function discoverCompetitorUrls(
  competitorName: string,
  userIndustry: string
): Promise<CompetitorUrls | null> {
  const prompt = `
Given competitor name: "${competitorName}"
User's industry: "${userIndustry}"

Find and return the official URLs for this company. Be accurate and only return real, verified URLs.

Return as JSON: {
  "name": "Official Company Name",
  "urls": {
    "website": "https://...",
    "blog": "https://...",
    "press": "https://...",
    "linkedin": "https://..."
  }
}

If you cannot find a URL with confidence, use an empty string "".
`;

  try {
    const response = await callXAI(prompt, 0.3);
    if (!response) return null;

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed as CompetitorUrls;
  } catch (error) {
    console.error('Error discovering competitor URLs:', error);
    return null;
  }
}

export async function generateCompetitorSuggestions(
  businessDescription: string,
  industry: string
): Promise<string[] | null> {
  const prompt = `
Given this business:
Industry: ${industry}
Description: ${businessDescription}

Suggest 5-8 key competitors or companies in the same space that this business should monitor.
Return ONLY a JSON array of company names: ["Company 1", "Company 2", ...]
`;

  try {
    const response = await callXAI(prompt, 0.5);
    if (!response) return null;

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error('Error generating competitor suggestions:', error);
    return null;
  }
}

export async function analyzeCompetitorActivity(
  competitorName: string,
  recentUpdates: Array<{ title: string; summary: string; date: string }>
): Promise<string | null> {
  const prompt = `
Analyze recent activity from competitor: ${competitorName}

Recent updates:
${recentUpdates.map((u, i) => `${i + 1}. ${u.title} (${u.date})\n   ${u.summary}`).join('\n\n')}

Provide a brief 2-3 sentence analysis of what this competitor is focusing on and any notable trends or strategic moves.
`;

  try {
    const response = await callXAI(prompt, 0.6);
    return response || null;
  } catch (error) {
    console.error('Error analyzing competitor activity:', error);
    return null;
  }
}

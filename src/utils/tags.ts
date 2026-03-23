export type TagType =
  | 'news'
  | 'grant'
  | 'grants'
  | 'funding'
  | 'regulation'
  | 'legislation'
  | 'government'
  | 'competitor'
  | 'market'
  | 'research'
  | 'technology'
  | 'policy';

export interface TagConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const TAG_CONFIGS: Record<string, TagConfig> = {
  news: {
    label: 'News',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  grant: {
    label: 'Grant',
    color: '#059669',
    bgColor: '#d1fae5',
    borderColor: '#6ee7b7',
  },
  grants: {
    label: 'Grants',
    color: '#059669',
    bgColor: '#d1fae5',
    borderColor: '#6ee7b7',
  },
  funding: {
    label: 'Funding Opportunity',
    color: '#059669',
    bgColor: '#d1fae5',
    borderColor: '#6ee7b7',
  },
  regulation: {
    label: 'Regulation',
    color: '#dc2626',
    bgColor: '#fee2e2',
    borderColor: '#fecaca',
  },
  legislation: {
    label: 'Legislation',
    color: '#dc2626',
    bgColor: '#fee2e2',
    borderColor: '#fecaca',
  },
  government: {
    label: 'Government',
    color: '#7c3aed',
    bgColor: '#f3e8ff',
    borderColor: '#d8b4fe',
  },
  competitor: {
    label: 'Competitor',
    color: '#ea580c',
    bgColor: '#ffedd5',
    borderColor: '#fed7aa',
  },
  market: {
    label: 'Market Analysis',
    color: '#0891b2',
    bgColor: '#cffafe',
    borderColor: '#a5f3fc',
  },
  research: {
    label: 'Research',
    color: '#4f46e5',
    bgColor: '#e0e7ff',
    borderColor: '#c7d2fe',
  },
  technology: {
    label: 'Technology',
    color: '#6366f1',
    bgColor: '#e0e7ff',
    borderColor: '#c7d2fe',
  },
  policy: {
    label: 'Policy',
    color: '#be123c',
    bgColor: '#ffe4e6',
    borderColor: '#fecdd3',
  },
};

export function getTagConfig(contentType: string): TagConfig {
  const normalizedType = contentType.toLowerCase().trim();

  return TAG_CONFIGS[normalizedType] || {
    label: contentType.charAt(0).toUpperCase() + contentType.slice(1),
    color: '#6b7280',
    bgColor: '#f3f4f6',
    borderColor: '#d1d5db',
  };
}

export function getTagsFromContentTypes(contentTypes: string[]): TagConfig[] {
  return contentTypes.map(type => getTagConfig(type));
}

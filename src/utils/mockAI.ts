export const getTopicSuggestions = (businessDescription: string, industry: string): string[] => {
  const lowerDesc = businessDescription.toLowerCase();
  const lowerIndustry = industry.toLowerCase();

  if (lowerDesc.includes('property') || lowerDesc.includes('real estate') || lowerIndustry.includes('real estate')) {
    return [
      'BC Rental Regulations',
      'Tenant Rights Updates',
      'Property Tax Changes',
      'Local Real Estate Market',
      'Housing Policy',
      'Eviction Laws',
      'Maintenance Standards',
      'Strata Regulations',
      'Landlord Insurance Updates',
      'Building Code Changes',
      'Rental Market Trends',
      'Property Investment News'
    ];
  }

  if (lowerDesc.includes('law') || lowerDesc.includes('legal') || lowerIndustry.includes('legal')) {
    return [
      'Legal Precedents',
      'Regulatory Changes',
      'Court Rulings',
      'Industry News',
      'Professional Development',
      'Law Society Updates',
      'Case Law Analysis',
      'Legislative Changes',
      'Legal Technology',
      'Ethics Guidelines',
      'Practice Management',
      'Client Rights'
    ];
  }

  if (lowerDesc.includes('tech') || lowerDesc.includes('software') || lowerIndustry.includes('technology')) {
    return [
      'AI & Machine Learning',
      'Cybersecurity Updates',
      'Software Development Trends',
      'Cloud Computing News',
      'Data Privacy Regulations',
      'Tech Industry News',
      'DevOps Best Practices',
      'Open Source Updates',
      'Product Launches',
      'Technology Regulations',
      'Developer Tools',
      'Industry Standards'
    ];
  }

  if (lowerDesc.includes('health') || lowerDesc.includes('medical') || lowerIndustry.includes('healthcare')) {
    return [
      'Healthcare Regulations',
      'Medical Research',
      'Patient Care Standards',
      'Health Insurance Updates',
      'Medical Technology',
      'Public Health Policies',
      'Drug Approvals',
      'Clinical Guidelines',
      'Healthcare Funding',
      'Medical Device News',
      'Telemedicine Updates',
      'Health Data Privacy'
    ];
  }

  if (lowerDesc.includes('finance') || lowerDesc.includes('banking') || lowerIndustry.includes('financial')) {
    return [
      'Financial Regulations',
      'Market Trends',
      'Banking Updates',
      'Investment News',
      'Cryptocurrency',
      'Tax Law Changes',
      'Interest Rate Updates',
      'Economic Indicators',
      'Compliance Requirements',
      'Fintech Innovation',
      'Securities Regulations',
      'Risk Management'
    ];
  }

  return [
    'Industry News',
    'Regulatory Changes',
    'Market Trends',
    'Competitor Activity',
    'Technology Updates',
    'Economic Indicators',
    'Policy Changes',
    'Consumer Trends',
    'Innovation & Research',
    'Professional Development',
    'Best Practices',
    'Emerging Opportunities'
  ];
};

export const getSourceSuggestions = (businessDescription: string, industry: string, topics: string[]): Array<{ name: string; url: string; description: string }> => {
  const lowerDesc = businessDescription.toLowerCase();
  const lowerIndustry = industry.toLowerCase();

  if (lowerDesc.includes('property') || lowerDesc.includes('real estate') || lowerIndustry.includes('real estate')) {
    return [
      {
        name: 'BC Residential Tenancy Branch',
        url: 'https://www2.gov.bc.ca/gov/content/housing-tenancy/residential-tenancies',
        description: 'Official government source for BC rental laws and regulations'
      },
      {
        name: 'CMHC Housing Market Information',
        url: 'https://www.cmhc-schl.gc.ca/en/professionals/housing-markets-data-and-research',
        description: 'Canadian housing market data and research'
      },
      {
        name: 'Real Estate Board of Greater Vancouver',
        url: 'https://www.rebgv.org/',
        description: 'Local real estate market statistics and trends'
      },
      {
        name: 'Urban Development Institute',
        url: 'https://udi.bc.ca/',
        description: 'Real estate development news and policy updates'
      },
      {
        name: 'BC Housing',
        url: 'https://www.bchousing.org/',
        description: 'Provincial housing news and programs'
      },
      {
        name: 'REW.ca News',
        url: 'https://www.rew.ca/news',
        description: 'Real estate news and market insights'
      },
      {
        name: 'Vancouver Is Awesome - Real Estate',
        url: 'https://www.vancouverisawesome.com/real-estate',
        description: 'Local real estate news and updates'
      },
      {
        name: 'BIV Real Estate News',
        url: 'https://biv.com/real-estate',
        description: 'Business real estate coverage'
      }
    ];
  }

  if (lowerDesc.includes('law') || lowerDesc.includes('legal') || lowerIndustry.includes('legal')) {
    return [
      {
        name: 'BC Courts',
        url: 'https://www.bccourts.ca/',
        description: 'Official BC court decisions and schedules'
      },
      {
        name: 'Law Society of BC',
        url: 'https://www.lawsociety.bc.ca/',
        description: 'Professional regulatory body updates'
      },
      {
        name: 'Canadian Lawyer Magazine',
        url: 'https://www.canadianlawyermag.com/',
        description: 'Legal industry news and insights'
      },
      {
        name: 'CanLII',
        url: 'https://www.canlii.org/',
        description: 'Free access to Canadian case law'
      },
      {
        name: 'BC Government Legislation',
        url: 'https://www.bclaws.gov.bc.ca/',
        description: 'Current BC laws and regulations'
      },
      {
        name: 'CBA BC',
        url: 'https://www.cbabc.org/',
        description: 'Canadian Bar Association updates'
      },
      {
        name: 'Legal Feeds',
        url: 'https://legalfeeds.ca/',
        description: 'Aggregated Canadian legal news'
      },
      {
        name: 'The Lawyer\'s Daily',
        url: 'https://www.thelawyersdaily.ca/',
        description: 'Daily legal news and analysis'
      }
    ];
  }

  if (lowerDesc.includes('tech') || lowerDesc.includes('software') || lowerIndustry.includes('technology')) {
    return [
      {
        name: 'TechCrunch',
        url: 'https://techcrunch.com/',
        description: 'Technology industry news and analysis'
      },
      {
        name: 'Hacker News',
        url: 'https://news.ycombinator.com/',
        description: 'Tech community news and discussions'
      },
      {
        name: 'The Verge',
        url: 'https://www.theverge.com/tech',
        description: 'Technology news and reviews'
      },
      {
        name: 'Ars Technica',
        url: 'https://arstechnica.com/',
        description: 'In-depth technology analysis'
      },
      {
        name: 'GitHub Blog',
        url: 'https://github.blog/',
        description: 'Developer tools and trends'
      },
      {
        name: 'Stack Overflow Blog',
        url: 'https://stackoverflow.blog/',
        description: 'Developer insights and trends'
      },
      {
        name: 'MIT Technology Review',
        url: 'https://www.technologyreview.com/',
        description: 'Emerging technology coverage'
      },
      {
        name: 'Wired',
        url: 'https://www.wired.com/',
        description: 'Technology and digital culture'
      }
    ];
  }

  return [
    {
      name: 'Industry News Wire',
      url: 'https://www.industrynewswire.com/',
      description: 'General industry news and updates'
    },
    {
      name: 'Reuters Business',
      url: 'https://www.reuters.com/business/',
      description: 'Global business news coverage'
    },
    {
      name: 'Bloomberg',
      url: 'https://www.bloomberg.com/',
      description: 'Financial and business news'
    },
    {
      name: 'The Globe and Mail Business',
      url: 'https://www.theglobeandmail.com/business/',
      description: 'Canadian business news'
    },
    {
      name: 'BNN Bloomberg',
      url: 'https://www.bnnbloomberg.ca/',
      description: 'Canadian business and financial news'
    },
    {
      name: 'Financial Post',
      url: 'https://financialpost.com/',
      description: 'Business and financial coverage'
    },
    {
      name: 'CBC Business',
      url: 'https://www.cbc.ca/news/business',
      description: 'Canadian business news'
    },
    {
      name: 'Business in Vancouver',
      url: 'https://biv.com/',
      description: 'Local business news and analysis'
    }
  ];
};

const RSS_FEED_DATABASE: Record<string, string> = {
  'theguardian.com': 'https://www.theguardian.com/world/rss',
  'bbc.com/sport': 'https://feeds.bbci.co.uk/sport/rss.xml',
  'bbc.co.uk/sport': 'https://feeds.bbci.co.uk/sport/rss.xml',
  'bloomberg.com': 'https://www.bloomberg.com/feed/podcast/etf-report.xml',
  'reuters.com': 'https://www.reuters.com/rssfeed/topNews',
  'nytimes.com': 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'wsj.com': 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
  'cnn.com': 'http://rss.cnn.com/rss/cnn_topstories.rss',
  'ft.com': 'https://www.ft.com/?format=rss',
  'techcrunch.com': 'https://techcrunch.com/feed/',
  'wired.com': 'https://www.wired.com/feed/rss',
  'theverge.com': 'https://www.theverge.com/rss/index.xml',
  'forbes.com': 'https://www.forbes.com/real-time/feed2/',
  'fortune.com': 'https://fortune.com/feed',
  'marketwatch.com': 'http://feeds.marketwatch.com/marketwatch/topstories/',
  'cnbc.com': 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  'businessinsider.com': 'https://www.businessinsider.com/rss',
  'economist.com': 'https://www.economist.com/sections/business-finance/rss.xml',
  'axios.com': 'https://api.axios.com/feed/',
  'politico.com': 'https://www.politico.com/rss/politics08.xml',
  'apnews.com': 'https://rsshub.app/apnews/topics/apf-topnews',
  'nbcnews.com': 'https://feeds.nbcnews.com/nbcnews/public/news',
  'abcnews.go.com': 'https://abcnews.go.com/abcnews/topstories',
  'cbsnews.com': 'https://www.cbsnews.com/latest/rss/main',
  'washingtonpost.com': 'https://feeds.washingtonpost.com/rss/business',
  'latimes.com': 'https://www.latimes.com/rss2.0.xml',
  'usatoday.com': 'http://rssfeeds.usatoday.com/usatoday-NewsTopStories',
  'time.com': 'https://time.com/feed/',
  'newsweek.com': 'https://www.newsweek.com/rss',
  'epa.gov': 'https://www.epa.gov/newsreleases/rss',
  'sec.gov': 'https://www.sec.gov/news/pressreleases.rss',
  'fda.gov': 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
  'cdc.gov': 'https://tools.cdc.gov/api/v2/resources/media/132608.rss',
  'nasa.gov': 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
  'nature.com': 'https://www.nature.com/nature.rss',
  'sciencedaily.com': 'https://www.sciencedaily.com/rss/all.xml',
  'technologyreview.com': 'https://www.technologyreview.com/feed/',
  'arstechnica.com': 'https://feeds.arstechnica.com/arstechnica/index',
  'engadget.com': 'https://www.engadget.com/rss.xml',
  'gizmodo.com': 'https://gizmodo.com/rss',
  'mashable.com': 'https://mashable.com/feeds/rss/all',
  'venturebeat.com': 'https://venturebeat.com/feed/',
  'zdnet.com': 'https://www.zdnet.com/news/rss.xml',
  'cnet.com': 'https://www.cnet.com/rss/news/',
  'espn.com': 'https://www.espn.com/espn/rss/news',
  'skysports.com': 'https://www.skysports.com/rss/12040',
  'theathletic.com': 'https://theathletic.com/rss/',
  'variety.com': 'https://variety.com/feed/',
  'hollywoodreporter.com': 'https://www.hollywoodreporter.com/feed/',
  'billboard.com': 'https://www.billboard.com/feed/',
  'rollingstone.com': 'https://www.rollingstone.com/feed/',
  'pitchfork.com': 'https://pitchfork.com/rss/news/',
};

const RSS_DOMAIN_PATTERNS: Array<[RegExp, string]> = [
  [/guardian\.com/, 'https://www.theguardian.com/world/rss'],
  [/bbc\.(com|co\.uk)\/sport/, 'https://feeds.bbci.co.uk/sport/rss.xml'],
  [/bbc\.(com|co\.uk)\/news/, 'https://feeds.bbci.co.uk/news/rss.xml'],
  [/bloomberg/, 'https://www.bloomberg.com/feed/podcast/etf-report.xml'],
  [/reuters/, 'https://www.reuters.com/rssfeed/topNews'],
  [/nytimes/, 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'],
  [/techcrunch/, 'https://techcrunch.com/feed/'],
  [/wired/, 'https://www.wired.com/feed/rss'],
  [/forbes/, 'https://www.forbes.com/real-time/feed2/'],
  [/cnbc/, 'https://www.cnbc.com/id/100003114/device/rss/rss.html'],
  [/cnn/, 'http://rss.cnn.com/rss/cnn_topstories.rss'],
];

export async function discoverRSSFeed(url: string): Promise<string | null> {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');

    if (RSS_FEED_DATABASE[domain]) {
      return RSS_FEED_DATABASE[domain];
    }

    for (const [pattern, feedUrl] of RSS_DOMAIN_PATTERNS) {
      if (pattern.test(url)) {
        return feedUrl;
      }
    }

    const commonPaths = [
      '/rss',
      '/feed',
      '/rss.xml',
      '/feed.xml',
      '/atom.xml',
      '/feeds/posts/default',
      '/blog/feed',
      '/news/rss',
    ];

    for (const path of commonPaths) {
      const potentialFeed = `${urlObj.protocol}//${urlObj.hostname}${path}`;
      const isValid = await validateRSSFeed(potentialFeed);
      if (isValid) {
        return potentialFeed;
      }
    }

    return null;
  } catch (error) {
    console.error('Error discovering RSS feed:', error);
    return null;
  }
}

async function validateRSSFeed(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    return response.ok && (
      contentType.includes('xml') ||
      contentType.includes('rss') ||
      contentType.includes('atom')
    );
  } catch (error) {
    return false;
  }
}

export function getRSSFeedForSource(sourceName: string, sourceUrl: string): string | null {
  const lowerName = sourceName.toLowerCase();
  const lowerUrl = sourceUrl.toLowerCase();

  if (lowerName.includes('guardian') || lowerUrl.includes('guardian')) {
    return 'https://www.theguardian.com/world/rss';
  }
  if (lowerName.includes('bbc sport') || lowerUrl.includes('bbc.co') && lowerName.includes('sport')) {
    return 'https://feeds.bbci.co.uk/sport/rss.xml';
  }
  if (lowerName.includes('bbc') && lowerName.includes('news')) {
    return 'https://feeds.bbci.co.uk/news/rss.xml';
  }
  if (lowerName.includes('bloomberg')) {
    return 'https://www.bloomberg.com/feed/podcast/etf-report.xml';
  }
  if (lowerName.includes('reuters')) {
    return 'https://www.reuters.com/rssfeed/topNews';
  }
  if (lowerName.includes('new york times') || lowerName.includes('nytimes')) {
    return 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml';
  }
  if (lowerName.includes('wall street journal') || lowerName.includes('wsj')) {
    return 'https://feeds.a.dj.com/rss/RSSWorldNews.xml';
  }
  if (lowerName.includes('cnn')) {
    return 'http://rss.cnn.com/rss/cnn_topstories.rss';
  }
  if (lowerName.includes('techcrunch')) {
    return 'https://techcrunch.com/feed/';
  }
  if (lowerName.includes('wired')) {
    return 'https://www.wired.com/feed/rss';
  }
  if (lowerName.includes('forbes')) {
    return 'https://www.forbes.com/real-time/feed2/';
  }
  if (lowerName.includes('cnbc')) {
    return 'https://www.cnbc.com/id/100003114/device/rss/rss.html';
  }
  if (lowerName.includes('epa') || lowerUrl.includes('epa.gov')) {
    return 'https://www.epa.gov/newsreleases/rss';
  }

  try {
    const urlObj = new URL(sourceUrl);
    const domain = urlObj.hostname.replace('www.', '');
    return RSS_FEED_DATABASE[domain] || null;
  } catch {
    return null;
  }
}

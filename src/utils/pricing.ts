export type SubscriptionTier = 'basic' | 'premium' | 'enterprise';

export type TierFeatures = {
  tier: SubscriptionTier;
  name: string;
  monthlyPrice: number;
  monthlyCredits: number;
  features: string[];
};

export type CreditPackage = {
  credits: number;
  price: number;
  label: string;
};

export const CREDITS_PER_SCAN = 25;

export const TIER_CONFIGS: Record<SubscriptionTier, TierFeatures & { productId: string }> = {
  basic: {
    tier: 'basic',
    name: 'Basic',
    monthlyPrice: 59,
    monthlyCredits: 100,
    productId: 'prod_TqxKX5neHjRYiu',
    features: [
      '3-day free trial included',
      '100 manual scan credits/month',
      'AI relevance scoring',
      'Dashboard delivery',
      'Priority support',
    ],
  },
  premium: {
    tier: 'premium',
    name: 'Premium',
    monthlyPrice: 99,
    monthlyCredits: 300,
    productId: 'prod_TqxLzaw1hDuXLo',
    features: [
      '3-day free trial included',
      '300 manual scan credits/month',
      'AI relevance scoring',
      'Dashboard delivery',
      'Priority support',
      'Advanced analytics',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199,
    monthlyCredits: 600,
    productId: 'prod_U7pGAo3uBjGCkb',
    features: [
      '3-day free trial included',
      '600 manual scan credits/month',
      'AI relevance scoring',
      'Dashboard delivery',
      'Custom update frequency (Daily, Bi-Weekly, Weekly)',
      'Email delivery (Slack & Teams coming soon)',
      'Priority support',
      'Advanced analytics',
    ],
  },
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  { credits: 100, price: 25, label: 'Starter Pack' },
  { credits: 300, price: 65, label: 'Popular' },
  { credits: 1000, price: 175, label: 'Power User' },
];

export function getTierConfig(tier: SubscriptionTier): TierFeatures {
  return TIER_CONFIGS[tier];
}

export function calculateScansFromCredits(credits: number): number {
  return Math.floor(credits / CREDITS_PER_SCAN);
}

export type PricingConfig = {
  tier: SubscriptionTier;
  contentTypeCount: number;
  deliveryMethod: 'dashboard' | 'email' | 'slack';
  deepAnalysis: boolean;
};

export type PricingBreakdown = {
  basePrice: number;
  contentTypesPrice: number;
  deliveryPrice: number;
  deepAnalysisPrice: number;
  subtotal: number;
  monthlyTotal: number;
  includedCredits: number;
  includedScans: number;
};

export function calculatePricing(config: PricingConfig): PricingBreakdown {
  const tierConfig = TIER_CONFIGS[config.tier || 'basic'];
  const basePrice = tierConfig.monthlyPrice;
  const contentTypesPrice = 0;
  const deliveryPrice = 0;
  const deepAnalysisPrice = config.deepAnalysis ? 20 : 0;

  const subtotal = basePrice + deepAnalysisPrice;
  const monthlyTotal = subtotal;

  const includedCredits = tierConfig.monthlyCredits;
  const includedScans = Math.floor(includedCredits / CREDITS_PER_SCAN);

  return {
    basePrice,
    contentTypesPrice,
    deliveryPrice,
    deepAnalysisPrice,
    subtotal,
    monthlyTotal,
    includedCredits,
    includedScans,
  };
}

export function getFrequencyLabel(frequency: 'monthly' | 'biweekly' | 'weekly' | 'daily'): string {
  return {
    monthly: 'Monthly',
    biweekly: 'Bi-Weekly',
    weekly: 'Weekly',
    daily: 'Daily',
  }[frequency];
}

export function getDeliveryMethodLabel(method: 'dashboard' | 'email' | 'slack'): string {
  return {
    dashboard: 'Dashboard',
    email: 'Email Digest',
    slack: 'Slack Integration',
  }[method];
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US')} CAD`;
}

export function getNextDeliveryDate(
  frequency: 'monthly' | 'biweekly' | 'weekly' | 'daily',
  lastDelivery?: Date
): Date {
  const now = lastDelivery || new Date();
  const next = new Date(now);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + (7 - next.getDay() + 1));
      next.setHours(9, 0, 0, 0);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + (14 - next.getDay() + 1));
      next.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(9, 0, 0, 0);
      break;
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      break;
  }

  return next;
}

export function formatNextDeliveryDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function getDeliveryBatchKey(frequency: 'monthly' | 'biweekly' | 'weekly' | 'daily', date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (frequency) {
    case 'weekly':
      const weekNumber = getWeekNumber(date);
      return `${year}-w${String(weekNumber).padStart(2, '0')}`;
    case 'biweekly':
      const biweekNumber = Math.floor(getWeekNumber(date) / 2);
      return `${year}-bw${String(biweekNumber).padStart(2, '0')}`;
    case 'monthly':
      return `${year}-${month}`;
    case 'daily':
      return `${year}-${month}-${day}`;
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getDeliveryBatchLabel(frequency: 'monthly' | 'biweekly' | 'weekly' | 'daily', batchKey: string): string {
  const parts = batchKey.split('-');
  const year = parts[0];

  switch (frequency) {
    case 'weekly':
      const weekNum = parts[1].replace('w', '');
      const weekDate = getDateOfISOWeek(parseInt(weekNum), parseInt(year));
      return `Week of ${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    case 'biweekly':
      const biweekNum = parts[1].replace('bw', '');
      const biweekDate = getDateOfISOWeek(parseInt(biweekNum) * 2, parseInt(year));
      return `Bi-Week of ${biweekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    case 'monthly':
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[parseInt(parts[1]) - 1]} ${year}`;
    case 'daily':
      const d = new Date(batchKey);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function getDateOfISOWeek(week: number, year: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return ISOweekStart;
}

/**
 * Triggers the scanner for a specific user.
 * For manual scans, this should be called AFTER credits are verified/spent.
 */
export async function triggerScannerWebhook(
  userId: string, 
  frequency: string, 
  isManual: boolean = false
): Promise<boolean> {
  const WEBHOOK_URL = 'https://hook.us2.make.com/pgl69xy425vg3zasl4v0j9qs18ogk9hu';

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        frequency: frequency,
        is_manual: isManual,
        triggered_at: new Date().toISOString()
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error triggering scanner webhook:', error);
    return false;
  }
}

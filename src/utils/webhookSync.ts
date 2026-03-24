/**
 * Syncs user settings and company profile with the external webhook (Make.com)
 */
export async function syncSettingsToWebhook(payload: {
  userId: string;
  email: string;
  companyId: string;
  companyName: string;
  industry: string;
  description: string;
  monitoringGoals: string[];
  topics: string[];
  sources: Array<{ name: string; url: string }>;
  location: {
    country: string;
    province: string;
    city: string;
  };
  context: string[];
}) {
  const WEBHOOK_URL = 'https://hook.us1.make.com/39pohsioq6r964k9560fajw41m9e1at1';

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'WatchDog_Settings_Sync'
      }),
    });

    if (!response.ok) {
      console.warn('Webhook sync failed:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error syncing to webhook:', error);
    return false;
  }
}

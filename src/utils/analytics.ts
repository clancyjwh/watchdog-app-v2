declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

export const trackEvent = (eventName: string, eventParams?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
};

export const trackPageView = (url: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
      page_title: title,
    });
  }
};

export const trackButtonClick = (buttonName: string, location: string) => {
  trackEvent('button_click', {
    button_name: buttonName,
    location: location,
  });
};

export const trackSignup = (method: string) => {
  trackEvent('sign_up', {
    method: method,
  });
};

export const trackLogin = (method: string) => {
  trackEvent('login', {
    method: method,
  });
};

export const trackPricingView = (plan: string) => {
  trackEvent('view_item', {
    items: [{
      item_name: plan,
      item_category: 'subscription_plan',
    }]
  });
};

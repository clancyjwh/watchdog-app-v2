import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Subscription, Source, PaymentHistory } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Activity, CreditCard, Download, Check, Zap, AlertCircle, Loader2, ChevronRight
} from 'lucide-react';
import { calculatePricing, PricingConfig, formatCurrency, getDeliveryMethodLabel, CREDIT_PACKAGES, TIER_CONFIGS, SubscriptionTier, getTierConfig } from '../utils/pricing';
import Sidebar from '../components/Sidebar';

export default function Billing() {
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadData();
    }
  }, [profile?.id, authLoading]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const [subscriptionRes, sourcesRes, paymentsRes] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('profile_id', profile.id).maybeSingle(),
        supabase.from('sources').select('*').eq('profile_id', profile.id),
        supabase.from('payment_history').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(10),
      ]);
      setSubscription(subscriptionRes.data);
      setSources(sourcesRes.data || []);
      setPaymentHistory(paymentsRes.data || []);
    } catch (error) {
      console.error('Error loading billing data:', error);
    }
  };

  const handleManageBilling = async () => {
    if (!profile?.id) return;
    setProcessingCheckout(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('create-billing-portal', {
        body: { profile_id: profile.id },
      });
      if (functionError) throw new Error(functionError.message);
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      alert('Failed to open billing portal.');
    } finally {
      setProcessingCheckout(false);
    }
  };

  const handlePurchaseCredits = (credits: number) => {
    const links = {
      100: 'https://buy.stripe.com/7sY4gz9OA673d9xgztfMA00',
      300: 'https://buy.stripe.com/00w9AT5ykbrnc5tdnhfMA01',
      1000: 'https://buy.stripe.com/4gMfZh6Co52Z3yX1EzfMA02',
    };
    const url = links[credits as keyof typeof links];
    if (url && profile?.id) {
      const stripeUrl = new URL(url);
      stripeUrl.searchParams.set('client_reference_id', profile.id);
      if (user?.email) stripeUrl.searchParams.set('prefilled_email', user.email);
      window.location.href = stripeUrl.toString();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  const pricing = calculatePricing({
    tier: (subscription?.subscription_tier as SubscriptionTier) || 'basic',
    sourceCount: sources.length,
    contentTypeCount: profile?.content_types?.length || 0,
    deliveryMethod: subscription?.delivery_method || 'dashboard',
    deepAnalysis: false,
  });

  const nextBillingDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-100 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="px-8 py-6 bg-[#020617]/80 backdrop-blur-md border-b border-slate-800/50 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-500" />
              Billing
            </h1>
            <p className="text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">Manage your subscription and credits</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-10 py-8 scrollbar-hide">
          <div className="max-w-5xl mx-auto space-y-10 pb-20 text-left">
            
            {/* Current Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900/40 border border-slate-800/50 rounded-3xl p-8 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-3xl font-black">{getTierConfig(subscription?.subscription_tier || 'basic').name}</h2>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/20 rounded-full">Active</span>
                    </div>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Renewal Date: {nextBillingDate.toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-blue-500">{formatCurrency(getTierConfig(subscription?.subscription_tier || 'basic').monthlyPrice)}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Per Month CAD</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-slate-300 mb-2">
                      <Zap className="w-4 h-4 text-blue-500 fill-blue-500" />
                      <span className="font-bold text-xs uppercase tracking-widest">Scan Capacity</span>
                    </div>
                    <p className="text-lg font-black text-white">{profile?.manual_scan_credits || 0} Credits Remaining</p>
                  </div>
                  <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-slate-300 mb-2">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold text-xs uppercase tracking-widest">Intelligence Pulse</span>
                    </div>
                    <p className="text-lg font-black text-white">{subscription?.frequency || 'Weekly'} Automated Updates</p>
                  </div>
                </div>

              </div>

              {/* Quick Top up */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-widest">Quick Top-Up</h3>
                <div className="space-y-4">
                  {[
                    { amt: 100, price: '$25' },
                    { amt: 300, price: '$65' },
                    { amt: 1000, price: '$175' },
                  ].map(pkg => (
                    <button
                      key={pkg.amt}
                      onClick={() => handlePurchaseCredits(pkg.amt)}
                      className="w-full flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800 transition-all group"
                    >
                      <span className="font-black text-xs">{pkg.amt} Credits</span>
                      <span className="font-black text-blue-500">{pkg.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subscription Tiers */}
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-xl font-black">Available Plans</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Upgrade or modify your subscription via Stripe</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    name: 'Basic',
                    price: 59,
                    features: ['7-day free trial included', '100 manual scan credits/month', 'AI relevance scoring', 'Dashboard delivery', 'Priority support'],
                    tierName: 'basic',
                    popular: false,
                  },
                  {
                    name: 'Premium',
                    price: 99,
                    features: ['7-day free trial included', '300 manual scan credits/month', 'AI relevance scoring', 'Dashboard delivery', 'Priority support', 'Advanced analytics'],
                    tierName: 'premium',
                    popular: true,
                  },
                  {
                    name: 'Enterprise',
                    price: 199,
                    features: ['7-day free trial included', '600 manual scan credits/month', 'AI relevance scoring', 'Dashboard delivery', 'Custom update frequency', 'Email delivery (coming soon)', 'Priority support', 'Advanced analytics'],
                    tierName: 'enterprise',
                    popular: false,
                  }
                ].map((plan) => (
                  <div
                    key={plan.name}
                    className={`relative bg-slate-900 border ${
                      plan.tierName === profile?.subscription_tier
                        ? 'border-blue-500 shadow-2xl shadow-blue-500/10'
                        : 'border-slate-800'
                    } rounded-3xl p-8 flex flex-col`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full">
                        Most Popular
                      </div>
                    )}
                    <div className="mb-8">
                      <h3 className="text-xl font-black text-white mb-2">{plan.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black text-white">${plan.price}</span>
                        <span className="text-slate-400 font-bold text-sm">/mo</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleManageBilling}
                      disabled={processingCheckout}
                      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest mb-8 transition-all flex items-center justify-center gap-2 ${
                        plan.tierName === profile?.subscription_tier
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : plan.popular
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      {processingCheckout 
                        ? 'Redirecting...' 
                        : plan.tierName === profile?.subscription_tier 
                          ? 'Current Plan (Manage)' 
                          : 'Switch Plan'}
                    </button>

                    <div className="space-y-4 flex-1">
                      {plan.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-slate-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoices */}
            <div className="space-y-6">
              <h2 className="text-xl font-black">Billing History</h2>
              <div className="bg-slate-900/20 border border-slate-800/50 rounded-3xl overflow-hidden">
                {paymentHistory.length === 0 ? (
                  <div className="p-12 text-center">
                    <Activity className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No transactions detected yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/50">
                    {paymentHistory.map(payment => (
                      <div key={payment.id} className="p-6 flex items-center justify-between hover:bg-slate-800/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                            <Download className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="font-black text-sm">{new Date(payment.created_at).toLocaleDateString()}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{payment.description || 'Service Payment'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm">{formatCurrency(payment.amount_cents / 100)}</p>
                          <span className="text-[9px] font-black uppercase text-emerald-400">Success</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

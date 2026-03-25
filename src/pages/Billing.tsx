import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Subscription, Source, PaymentHistory } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, CreditCard, Download, Check, Zap, AlertCircle, X
} from 'lucide-react';
import { calculatePricing, PricingConfig, formatCurrency, getFrequencyLabel, getDeliveryMethodLabel, CREDIT_PACKAGES, TIER_CONFIGS, SubscriptionTier, getTierConfig, calculateScansFromCredits } from '../utils/pricing';

// Stripe Elements and Card Input removed in favor of direct Payment Links

export default function Billing() {
  const { profile, user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [showCardForm, setShowCardForm] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    if (profile?.id && !authLoading) {
      loadData();
    }
  }, [profile?.id, authLoading]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setTimeout(() => {
        loadData();
      }, 2000);
    }
  }, []);

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

  // handleCardSuccess and legacy process-payment logic removed

  const handlePurchaseCredits = (pkg: typeof CREDIT_PACKAGES[0]) => {
    const stripeLinks = {
      100: 'https://buy.stripe.com/7sY4gz9OA673d9xgztfMA00',
      300: 'https://buy.stripe.com/00w9AT5ykbrnc5tdnhfMA01',
      1000: 'https://buy.stripe.com/4gMfZh6Co52Z3yX1EzfMA02',
    };

    const link = stripeLinks[pkg.credits as keyof typeof stripeLinks];
    if (link && profile?.id) {
      const stripeUrl = new URL(link);
      stripeUrl.searchParams.set('client_reference_id', profile.id);
      if (user?.email) stripeUrl.searchParams.set('prefilled_email', user.email);
      window.location.href = stripeUrl.toString();
    }
  };

  const handleManageBilling = async () => {
    if (!profile?.id) return;

    setProcessingCheckout(true);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('create-billing-portal', {
        body: {
          profile_id: profile.id,
        },
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to create billing portal');
      }
      if (data && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || 'No portal URL returned');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setProcessingCheckout(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    navigate('/login');
    return null;
  }

  const config: PricingConfig = {
    frequency: subscription?.frequency || 'weekly',
    sourceCount: sources.length,
    contentTypeCount: profile?.content_types?.length || 0,
    deliveryMethod: subscription?.delivery_method || 'dashboard',
    deepAnalysis: false,
  };

  const pricing = calculatePricing(config);
  const nextBillingDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const getStatusBadge = () => {
    const status = subscription?.subscription_status || 'active';
    const configs = {
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
      trialing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Trial' },
      past_due: { bg: 'bg-red-100', text: 'text-red-800', label: 'Past Due' },
      canceled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Canceled' },
      unpaid: { bg: 'bg-red-100', text: 'text-red-800', label: 'Unpaid' },
      incomplete: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Incomplete' },
    };
    const config = configs[status] || configs.active;
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-5xl mx-auto p-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Updates
        </button>

        <div className="flex items-center gap-3 mb-8">
          <CreditCard className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Billing</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Current Plan */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-8 border border-gray-200">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {getTierConfig(subscription?.subscription_tier || 'basic').name}
                  </h2>

                  {getStatusBadge()}
                </div>
                <p className="text-gray-600">
                  {subscription?.cancel_at_period_end
                    ? 'Cancels at period end'
                    : subscription?.subscription_status === 'trialing'
                    ? 'Trial period'
                    : 'Active subscription'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-blue-600">
                  {formatCurrency(pricing.monthlyTotal)}
                </p>
                <p className="text-gray-600">/month</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-900 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">Next billing date</span>
                </div>
                <p className="text-blue-800 font-medium">
                  {nextBillingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-900 mb-2">
                  <Zap className="w-5 h-5" />
                  <span className="font-semibold">Manual Scan Credits</span>
                </div>
                <p className="text-green-800 font-medium">
                  {profile?.manual_scan_credits || 0} credits ({Math.floor((profile?.manual_scan_credits || 0) / 25)} scans)
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-bold text-gray-900 mb-4">Plan Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Base plan ({getTierConfig(subscription?.subscription_tier || 'basic').name.toLowerCase()})
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(getTierConfig(subscription?.subscription_tier || 'basic').monthlyPrice)}
                  </span>
                </div>


                {pricing.deliveryPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {getDeliveryMethodLabel(subscription?.delivery_method || 'dashboard')}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(pricing.deliveryPrice)}
                    </span>
                  </div>
                )}
                {pricing.deepAnalysisPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Deep Analysis</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(pricing.deepAnalysisPrice)}
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-gray-900 text-lg">
                    {formatCurrency(getTierConfig(subscription?.subscription_tier || 'basic').monthlyPrice)}/month
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mt-4">
              <div className="flex items-center gap-2 text-green-900 mb-1">
                <Zap className="w-4 h-4" />
                <span className="font-semibold text-sm">Manual Scan Credits</span>
              </div>
              <p className="text-xs text-green-800">
                {pricing.includedCredits} credits included per month ({pricing.includedScans} manual scans)
              </p>
              <p className="text-xs text-green-700 mt-1">
                Credits reset monthly • Additional credits available below
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleManageBilling}
                disabled={processingCheckout || !subscription?.stripe_customer_id}
                className="flex-1 px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingCheckout ? 'Loading...' : 'Manage Subscription'}
              </button>
            </div>
            {!subscription?.stripe_customer_id && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Visit Settings to set up your subscription
              </p>
            )}
          </div>
        </div>

        {/* Subscription Tiers */}
        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-200 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Subscription Plans</h2>
          <p className="text-sm text-gray-600 mb-6">
            Choose the plan that best fits your monitoring needs. All plans include customizable update frequency.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.values(TIER_CONFIGS).map((tier) => {
              const isCurrentTier = subscription?.subscription_tier === tier.tier;

              return (
                <div
                  key={tier.tier}
                  className={`border-2 rounded-xl p-6 transition-all ${
                    isCurrentTier
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {isCurrentTier && (
                    <div className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full mb-3">
                      CURRENT PLAN
                    </div>
                  )}
                  {tier.tier === 'premium' && !isCurrentTier && (
                    <div className="inline-block px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full mb-3">
                      POPULAR
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-blue-600">
                        {formatCurrency(tier.monthlyPrice)}
                      </span>
                      <span className="text-gray-600">/month</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => {
                      if (!isCurrentTier) {
                        const tierConfig = TIER_CONFIGS[tier.tier];
                        if (tierConfig.paymentLink && profile?.id) {
                          setProcessingCheckout(true);
                          const stripeUrl = new URL(tierConfig.paymentLink);
                          stripeUrl.searchParams.set('client_reference_id', profile.id);
                          if (user?.email) stripeUrl.searchParams.set('prefilled_email', user.email);
                          window.location.href = stripeUrl.toString();
                        } else {
                          alert('Payment link not configured for this tier.');
                        }
                      }
                    }}
                    disabled={isCurrentTier || processingCheckout}
                    className={`w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      isCurrentTier
                        ? 'bg-gray-100 text-gray-600'
                        : tier.tier === 'premium'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {isCurrentTier ? 'Current Plan' : processingCheckout ? 'Redirecting...' : 'Upgrade Now'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  Update frequency doesn't change price
                </p>
                <p className="text-xs text-blue-800">
                  Choose between monthly, bi-weekly, or weekly automated updates at no extra cost. Manual scans cost 25 credits each.
                </p>
              </div>
            </div>
          </div>
        </div>



        {/* Billing History */}
        <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Billing History</h2>

          {paymentHistory.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No payment history yet</p>
              <p className="text-sm text-gray-500 mt-1">Your invoices will appear here</p>

              {!profile?.stripe_customer_id && (
                <div className="mt-8 pt-8 border-t border-gray-200 max-w-md mx-auto">
                  <p className="text-sm font-semibold text-gray-700 mb-4">Start your subscription</p>
                  <button
                    onClick={() => {
                      const tierConfig = TIER_CONFIGS['basic'];
                      if (tierConfig.paymentLink && profile?.id) {
                        setProcessingCheckout(true);
                        const stripeUrl = new URL(tierConfig.paymentLink);
                        stripeUrl.searchParams.set('client_reference_id', profile.id);
                        if (user?.email) stripeUrl.searchParams.set('prefilled_email', user.email);
                        window.location.href = stripeUrl.toString();
                      }
                    }}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Choose Plan & Continue
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {paymentHistory.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      payment.status === 'paid' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Download className={`w-5 h-5 ${
                        payment.status === 'paid' ? 'text-green-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {new Date(payment.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          payment.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {payment.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatCurrency(payment.amount_cents / 100)} • {payment.description || payment.transaction_type}
                      </p>
                    </div>
                  </div>
                  {payment.invoice_pdf_url && (
                    <a
                      href={payment.invoice_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg font-medium transition-colors"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import {
  Zap, TrendingUp, Target,
  ArrowRight, Sparkles, BarChart3, Search, CheckCircle
} from 'lucide-react';
import { trackButtonClick, trackPageView } from '../utils/analytics';
import { useEffect } from 'react';

export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView('/', 'Home');
  }, []);

  const features = [
    {
      icon: Search,
      title: 'Custom News',
      description: 'You input your business details, our AIs find stories that matter',
    },
    {
      icon: Target,
      title: 'Relevance Score',
      description: 'Each story is ranked 1-10 based on how relevant it is to your business',
    },
    {
      icon: TrendingUp,
      title: 'Next Steps',
      description: 'Our AI tells you how to use these updates to your advantage',
    },
    {
      icon: BarChart3,
      title: 'Readability',
      description: 'Each update is presented clearly on your dashboard',
    },
  ];

  const plans = [
    {
      name: 'Basic',
      price: 59,
      frequency: 'month',
      credits: 100,
      scans: 4,
      sources: 3,
      tier: 'basic',
      features: [
        'Up to 3 monitored sources',
        '100 manual scan credits/month',
        'AI relevance scoring',
        'Dashboard delivery',
        'Priority support',
      ],
      popular: false,
    },
    {
      name: 'Premium',
      price: 99,
      frequency: 'month',
      credits: 300,
      scans: 12,
      sources: 5,
      tier: 'premium',
      features: [
        'Up to 5 monitored sources',
        '300 manual scan credits/month',
        'AI relevance scoring',
        'Dashboard delivery',
        'Priority support',
        'Advanced analytics',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 199,
      frequency: 'month',
      credits: 600,
      scans: 24,
      sources: 10,
      tier: 'enterprise',
      features: [
        'Up to 10 monitored sources',
        '600 manual scan credits/month',
        'AI relevance scoring',
        'Dashboard delivery',
        'Email delivery (Slack & Teams coming soon)',
        'Priority support',
        'Advanced analytics',
      ],
      popular: false,
    },
  ];


  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-lg fixed w-full top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">WatchDog AI</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  trackButtonClick('Sign In', 'nav');
                  navigate('/login');
                }}
                className="px-4 py-2 text-gray-700 font-medium hover:text-gray-900 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  trackButtonClick('Get Started', 'nav');
                  navigate('/signup');
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              AI-Powered Business Intelligence
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Monitor What Matters
            </h1>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed">
              WatchDog tracks what matters to you; funding opportunities, news, regulations, legislation and more
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => {
                    trackButtonClick('Get Started', 'hero');
                    navigate('/signup');
                  }}
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all hover:scale-105 shadow-lg shadow-blue-600/20"
                >
                  Get Started
                  <ArrowRight className="inline-block ml-2 w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">3 day free trial</span>
              </div>
              <button
                onClick={() => {
                  trackButtonClick('View Pricing', 'hero');
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-8 py-4 bg-white text-gray-900 rounded-lg font-semibold text-lg border-2 border-gray-300 hover:border-gray-400 transition-colors"
              >
                View Pricing
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything you need to stay informed
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to help you monitor what matters most to your business
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in minutes with our simple three-step process
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Define Your Interests',
                description: 'Tell us about your business, competitors, and topics you want to track.',
              },
              {
                step: '02',
                title: 'AI Discovers Sources',
                description: 'Our AI finds and monitors relevant sources automatically based on your interests.',
              },
              {
                step: '03',
                title: 'Receive Curated Updates',
                description: 'Get AI-filtered digests on your dashboard. Email delivery available for Enterprise (Slack & Teams coming soon).',
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="text-6xl font-bold text-blue-100 mb-4">{item.step}</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
                {index < 2 && (
                  <div className="hidden md:block absolute top-12 -right-4 w-8 h-0.5 bg-blue-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose the update frequency that works for you. All plans include unlimited sources and AI filtering.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.popular
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-2xl shadow-blue-600/30 transform scale-105'
                    : 'bg-white border-2 border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold mb-4">
                    MOST POPULAR
                  </div>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold">${plan.price}</span>
                  <span className={`text-lg ${plan.popular ? 'text-white/80' : 'text-gray-600'}`}>
                    /{plan.frequency}
                  </span>
                </div>
                <div className={`text-sm mb-6 ${plan.popular ? 'text-white/90' : 'text-gray-600'}`}>
                  <p>{plan.credits} credits/month ({plan.scans} manual scans)</p>
                </div>
                <button
                  onClick={() => {
                    trackButtonClick(`Get Started - ${plan.name}`, 'pricing');
                    navigate('/signup');
                  }}
                  className={`w-full py-3 rounded-lg font-semibold mb-6 transition-all ${
                    plan.popular
                      ? 'bg-white text-blue-600 hover:bg-gray-100'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Get Started
                </button>
                <ul className="space-y-3">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3">
                      <CheckCircle className={`w-5 h-5 flex-shrink-0 ${plan.popular ? 'text-white' : 'text-blue-600'}`} />
                      <span className={`text-sm ${plan.popular ? 'text-white/90' : 'text-gray-700'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">
              Need more credits? Add-on packages available starting at $25
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 border border-yellow-200 rounded-lg mb-2">
              <Sparkles className="w-4 h-4 text-yellow-700" />
              <span className="text-sm font-semibold text-yellow-800">Slack & Teams Coming Soon</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Email delivery available now for Enterprise. Slack, Teams, and custom webhooks coming soon.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-cyan-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-10">
            Stay ahead of the curve
          </h2>
          <button
            onClick={() => {
              trackButtonClick('Get Started', 'cta');
              navigate('/signup');
            }}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-all hover:scale-105 shadow-xl"
          >
            Get Started
            <ArrowRight className="inline-block ml-2 w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">WatchDog AI</span>
              </div>
              <p className="text-sm leading-relaxed">
                AI-powered business intelligence that keeps you informed and ahead.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Use Cases</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-sm text-center">
            <p>&copy; 2024 WatchDog AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, Subscription } from '../lib/supabase';
import { Activity, Users, DollarSign, TrendingUp, ArrowLeft, Calendar } from 'lucide-react';

type UserData = {
  profile: Profile;
  subscription: Subscription | null;
  topicsCount: number;
  sourcesCount: number;
};

export default function Admin() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData[]>([]);
  const [totalMRR, setTotalMRR] = useState(0);
  const [activeJobs, setActiveJobs] = useState(0);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('onboarding_completed', true);

      if (!profiles) {
        setLoading(false);
        return;
      }

      const usersData: UserData[] = [];
      let mrr = 0;
      let jobs = 0;

      for (const profile of profiles) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('profile_id', profile.id)
          .maybeSingle();

        const { count: topicsCount } = await supabase
          .from('topics')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', profile.id);

        const { count: sourcesCount } = await supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', profile.id);

        usersData.push({
          profile,
          subscription: subscription || null,
          topicsCount: topicsCount || 0,
          sourcesCount: sourcesCount || 0,
        });

        if (subscription) {
          mrr += subscription.monthly_price;
          jobs += sourcesCount || 0;
        }
      }

      setUserData(usersData);
      setTotalMRR(mrr);
      setActiveJobs(jobs);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                  <p className="text-xs text-gray-600">WatchDog AI Analytics</p>
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{userData.length}</h3>
            <p className="text-sm text-gray-600">Total Users</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">${totalMRR.toFixed(2)}</h3>
            <p className="text-sm text-gray-600">Monthly Recurring Revenue</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{activeJobs}</h3>
            <p className="text-sm text-gray-600">Active Monitoring Jobs</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    MRR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Topics
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sources
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {userData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No users yet
                    </td>
                  </tr>
                ) : (
                  userData.map((user) => (
                    <tr key={user.profile.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-semibold text-gray-900">{user.profile.company_name}</div>
                          <div className="text-sm text-gray-600 truncate max-w-xs">
                            {user.profile.business_description}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.profile.industry}</td>
                      <td className="px-6 py-4">
                        {user.subscription ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 capitalize">
                            {user.subscription.frequency}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">No plan</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {user.subscription ? `$${user.subscription.monthly_price.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.topicsCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.sourcesCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(user.profile.created_at)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {userData.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Signups</h2>
            <div className="space-y-3">
              {userData
                .sort((a, b) => new Date(b.profile.created_at).getTime() - new Date(a.profile.created_at).getTime())
                .slice(0, 5)
                .map((user) => (
                  <div key={user.profile.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-indigo-600">
                          {user.profile.company_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.profile.company_name}</p>
                        <p className="text-sm text-gray-600">{user.profile.industry}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{formatDate(user.profile.created_at)}</p>
                      {user.subscription && (
                        <p className="text-xs text-green-600 font-medium">
                          ${user.subscription.monthly_price}/mo
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

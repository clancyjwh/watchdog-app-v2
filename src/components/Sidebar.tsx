import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Activity, BarChart3, Zap, Heart, Settings, 
  CreditCard, LogOut, ChevronRight, Building2,
  LayoutDashboard, Archive
} from 'lucide-react';
import CompanySwitcher from './CompanySwitcher';

export default function Sidebar() {
  const { user, profile, signOut, isAdmin, effectiveCredits } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }: { path: string, icon: any, label: string }) => (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        isActive(path)
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200/50'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
        isActive(path) ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
      }`} />
      <span className="font-semibold text-sm tracking-tight">{label}</span>
      {isActive(path) && <ChevronRight className="w-4 h-4 ml-auto opacity-70" />}
    </button>
  );

  return (
    <div className="w-72 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      {/* Brand Section */}
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/50 transform rotate-3">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight uppercase">
              WatchDog
            </h1>
            <span className="text-[10px] font-bold text-indigo-500 tracking-[0.2em] uppercase">
              Intelligence
            </span>
          </div>
        </div>
      </div>

      {/* Context/Switcher Section */}
      <div className="px-6 py-4">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="mb-3">
            <CompanySwitcher />
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
            <div className="w-9 h-9 bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 text-sm font-bold border border-white shadow-sm">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {profile?.company_name || 'Admin'}
              </p>
              <p className="text-[10px] font-medium text-slate-400 truncate">
                {isAdmin ? 'Enterprise Admin' : profile?.subscription_tier || 'Basic'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-6 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Main Menu</p>
        <NavItem path="/dashboard" icon={LayoutDashboard} label="Intelligence" />
        <NavItem path="/scans" icon={Zap} label="Deep Research" />
        <NavItem path="/archive" icon={Archive} label="Archive" />
        <NavItem path="/favorites" icon={Heart} label="Favorites" />

        <div className="pt-6">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Account</p>
          <NavItem path="/settings" icon={Settings} label="Settings" />
          <NavItem path="/billing" icon={CreditCard} label="Billing" />
        </div>
      </nav>

      {/* Status Footer */}
      <div className="p-6 mt-auto border-t border-slate-100 bg-slate-50/50">
        {isAdmin && (
          <div className="mb-4 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Admin Credits</p>
            <p className="text-sm font-black text-indigo-900 tracking-tight">UNLIMITED</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all font-bold text-sm"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

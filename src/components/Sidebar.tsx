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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
        isActive(path)
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
      }`}
    >
      <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${
        isActive(path) ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'
      }`} />
      <span className="font-bold text-[13px] tracking-tight">{label}</span>
      {isActive(path) && (
        <div className="absolute left-0 w-1 h-2/3 bg-white/40 rounded-full" />
      )}
    </button>
  );

  return (
    <div className="w-72 bg-[#020617] border-r border-slate-800/50 flex flex-col h-screen sticky top-0 z-50">
      {/* Brand Section */}
      <div className="p-8 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 border border-blue-400/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-none tracking-tight uppercase italic">
              WatchDog
            </h1>
            <p className="text-[10px] font-black text-blue-500 tracking-[0.2em] uppercase mt-1">
              Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Profile Section - Dark Theme */}
      <div className="px-6 py-6">
        <div className="bg-slate-900/40 rounded-[2rem] p-5 border border-slate-800/50 backdrop-blur-sm shadow-inner overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none transition-opacity group-hover:opacity-10">
            <LayoutDashboard className="w-24 h-24 text-blue-500" />
          </div>
          <div className="mb-4 relative z-10">
            <CompanySwitcher />
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-slate-800/50 relative z-10">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-100 text-sm font-black border border-slate-700 shadow-lg">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-100 truncate">
                {profile?.company_name || 'Admin'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate">
                  {isAdmin ? 'Enterprise Elite' : profile?.subscription_tier || 'Strategic Tier'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation - Strategic Pillars */}
      <nav className="flex-1 px-6 py-4 space-y-1.5 overflow-y-auto custom-scrollbar relative">
        <div className="px-4 mb-3">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Operational Pillars</p>
        </div>
        
        <NavItem path="/dashboard" icon={LayoutDashboard} label="Home" />
        <NavItem path="/scans" icon={Zap} label="Deep Research" />
        <NavItem path="/vault" icon={Archive} label="The Vault" />
        <NavItem path="/favourites" icon={Heart} label="Favourites" />

        <div className="pt-8 mb-3">
          <p className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Intelligence Config</p>
        </div>
        <NavItem path="/settings" icon={Settings} label="Global Settings" />
        <NavItem path="/billing" icon={CreditCard} label="Subscription" />
      </nav>

      {/* Status Footer */}
      <div className="p-6 mt-auto border-t border-slate-800/50 bg-slate-900/20 backdrop-blur-md">
        {isAdmin && (
          <div className="mb-6 px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl group hover:bg-blue-500/10 transition-colors cursor-default">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Neural Credits</p>
              <Activity className="w-3 h-3 text-blue-500/50 group-hover:animate-spin" />
            </div>
            <p className="text-sm font-black text-white tracking-widest">UNLIMITED</p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl text-slate-500 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 border border-transparent transition-all font-black text-[11px] uppercase tracking-[0.2em]"
        >
          <LogOut className="w-4 h-4" />
          Terminate Session
        </button>
      </div>
    </div>
  );
}

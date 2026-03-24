import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, Company } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  currentCompany: Company | null;
  companies: Company[];
  isAdmin: boolean;
  effectiveCredits: number;
  signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; profile: Profile | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  addCompany: (company: Omit<Company, 'id' | 'user_id' | 'created_at'>) => Promise<{ error: Error | null; company: Company | null }>;
  completeSignup: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingProfile = useRef(false);
  const isSigningUp = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      if (isSigningUp.current) {
        console.log('Ignoring auth state change during signup');
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Only show global loading on initial sign in if no profile exists
        const silent = event !== 'SIGNED_IN' || !!profile;
        fetchProfile(session.user.id, silent);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, silent = false) => {
    if (fetchingProfile.current) {
      return;
    }

    fetchingProfile.current = true;
    if (!silent) setLoading(true);
    try {
      const [profileRes, companiesRes, userRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('companies')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        supabase.auth.getUser()
      ]);

      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        throw profileRes.error;
      }

      if (!profileRes.data && userRes.data.user) {
        console.warn('Profile not found, creating default profile');
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            email: userRes.data.user.email || '',
            full_name: userRes.data.user.user_metadata?.full_name || '',
            company_name: 'My Company',
            onboarding_completed: false,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating profile:', createError);
          throw createError;
        }
        setProfile(newProfile);
      } else {
        setProfile(profileRes.data);
      }

      setCompanies(companiesRes.data || []);

      const currentProfile = profileRes.data || (await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()).data;

      if (currentProfile?.current_company_id) {
        const currentComp = companiesRes.data?.find(c => c.id === currentProfile.current_company_id);
        setCurrentCompany(currentComp || null);
      } else if (companiesRes.data && companiesRes.data.length > 0) {
        setCurrentCompany(companiesRes.data[0]);
        await supabase
          .from('profiles')
          .update({ current_company_id: companiesRes.data[0].id })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setCompanies([]);
      setCurrentCompany(null);
    } finally {
      setLoading(false);
      fetchingProfile.current = false;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, true);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, companyName: string) => {
    try {
      isSigningUp.current = true;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('No user returned from signup');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          full_name: fullName,
          email: email,
          company_name: companyName,
          onboarding_completed: false,
          subscription_tier: 'basic',
          subscription_status: 'inactive',
          manual_scan_credits: 0
        })
        .select()
        .single();

      if (profileError) throw profileError;

      setUser(data.user);
      setSession(data.session);
      setProfile(profileData);
      setLoading(false);
      fetchingProfile.current = false;

      return { error: null };
    } catch (error) {
      isSigningUp.current = false;
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        await fetchProfile(data.user.id);
        const profileRes = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();

        return { error: null, profile: profileRes.data };
      }

      return { error: null, profile: null };
    } catch (error) {
      return { error: error as Error, profile: null };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const switchCompany = async (companyId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ current_company_id: companyId })
        .eq('user_id', user.id);

      const company = companies.find(c => c.id === companyId);
      if (company) {
        setCurrentCompany(company);
      }

      await refreshProfile();
    } catch (error) {
      console.error('Error switching company:', error);
    }
  };

  const addCompany = async (companyData: Omit<Company, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return { error: new Error('No user logged in'), company: null };

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          ...companyData,
        })
        .select()
        .single();

      if (error) throw error;

      setCompanies(prev => [...prev, data]);

      if (companies.length === 0) {
        await switchCompany(data.id);
      }

      return { error: null, company: data };
    } catch (error) {
      return { error: error as Error, company: null };
    }
  };

  const completeSignup = () => {
    isSigningUp.current = false;
  };

    const isAdmin = user?.email === 'clancyjhodgins@gmail.com';
    const effectiveCredits = isAdmin ? 999999 : (profile?.manual_scan_credits || 0);

    return (
      <AuthContext.Provider value={{
        user,
        session,
        profile,
        currentCompany,
        companies,
        loading,
        isAdmin,
        effectiveCredits,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        switchCompany,
        addCompany,
        completeSignup
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateQuote } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Industry, QuoteResult, HistoryItem, User } from './shared-types';
import { IndustrySelector } from './components/IndustrySelector';
import { QuoteResultCard } from './components/QuoteResultCard';
import { LoginPage } from './components/LoginPage';
import { BillingPortal } from './components/BillingPortal';
import { PaymentSuccessPage } from './components/PaymentSuccessPage';
import { EmailCaptureModal } from './components/EmailCaptureModal';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { STRIPE_LINKS } from './constants';
import { Loader2, AlertCircle, Zap, History, LayoutTemplate, Menu, X, ArrowRight, MapPin, Hammer, Wrench, Check } from 'lucide-react';

const MAX_FREE_QUOTES = 3;

type ViewState = 'landing' | 'login' | 'billing' | 'payment_success' | 'reset_password';

const BrandLogo: React.FC = () => (
  <div className="relative w-11 h-11 bg-[#003366] rounded-full flex items-center justify-center shadow-md shrink-0 overflow-hidden border-2 border-white ring-1 ring-slate-900/10">
    <div className="absolute inset-[3px] rounded-full border-2 border-white"></div>
    <div className="relative w-full h-full flex items-center justify-center z-10">
      <Hammer className="absolute w-5 h-5 text-white -translate-x-[1px] -translate-y-[1px] scale-x-[-1] rotate-12" strokeWidth={2.5} />
      <Wrench className="absolute w-5 h-5 text-white translate-x-[1px] translate-y-[1px] -rotate-12" strokeWidth={2.5} />
    </div>
  </div>
);

const App: React.FC = () => {
  // State
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [user, setUser] = useState<User | null>(null);

  const [industry, setIndustry] = useState<Industry>(Industry.ROOFING);
  const [jobDescription, setJobDescription] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Email Capture State
  const [showEmailModal, setShowEmailModal] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  // Check for Reset Password URL on Mount
  useEffect(() => {
    const path = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;

    const isRecovery =
      path === '/reset-password' ||
      search.includes('type=recovery') ||
      hash.includes('type=recovery');

    if (isRecovery) {
      setCurrentView('reset_password');
    }
  }, []);

  // Memoize fetchUserProfile
  const fetchUserProfile = useCallback(async (userId: string, email: string) => {
    if (!supabase) return;
    const client = supabase!;

    try {
      const [authResponse, dbResponse] = await Promise.all([
        client.auth.getUser(),
        client.from('users').select('*').eq('id', userId).maybeSingle()
      ]);

      const authUser = authResponse.data.user;
      const authMetadata = authUser?.user_metadata || {};
      const dbData = dbResponse.data;

      let status = dbData?.status || 'trial';
      let plan = dbData?.plan || 'starter';

      if (authMetadata.status === 'active' && status !== 'active') {
        status = 'active';
        plan = 'pro';

        try {
          await client.from('users').upsert({
            id: userId,
            email: email,
            status: 'active',
            plan: 'pro',
            company_name: dbData?.company_name || authMetadata.company_name,
            company_phone: dbData?.company_phone,
            company_address: dbData?.company_address,
            updated_at: new Date().toISOString()
          });
        } catch (e) { console.warn("DB sync error", e); }
      }

      const u: User = {
        id: userId,
        email: dbData?.email || email,
        plan: plan as 'starter' | 'pro',
        status: status as 'active' | 'trial' | 'expired' | 'cancelled',
        trialStartDate: dbData?.created_at ? new Date(dbData.created_at).getTime() : Date.now(),
        companyName: dbData?.company_name,
        companyPhone: dbData?.company_phone,
        companyAddress: dbData?.company_address
      };
      setUser(u);
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  }, []);

  // Initialize
  useEffect(() => {
    // Check for API Key
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setApiKeyMissing(true);
    }

    const storedCount = localStorage.getItem('quoteUsageCount');
    if (storedCount) setUsageCount(parseInt(storedCount, 10));

    const storedHistory = localStorage.getItem('quoteHistory');
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (e) { console.error("Failed to parse history", e); }
    }

    if (!isSupabaseConfigured() || !supabase) {
      const storedUser = localStorage.getItem('quoteGenUser');
      if (storedUser) {
        try {
          const parsedUser: User = JSON.parse(storedUser);
          if (!parsedUser.id) parsedUser.id = 'local_' + Date.now();
          setUser(parsedUser);
        } catch (e) { console.error("Failed to parse user", e); }
      }
      return;
    }

    const client = supabase!;

    client.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const isRecovery = window.location.hash.includes('type=recovery') || window.location.pathname === '/reset-password';
        if (!isRecovery) {
          await fetchUserProfile(session.user.id, session.user.email || '');
        }
      }
    });

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, session) => {
      const isRecovery = window.location.hash.includes('type=recovery') || window.location.pathname === '/reset-password';

      if (event === 'PASSWORD_RECOVERY' || isRecovery) {
        setCurrentView('reset_password');
      } else if (!session) {
        if (!isRecovery) {
          setUser(null);
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (isRecovery) {
          setCurrentView('reset_password');
          return;
        }

        if (session) {
          const pendingEmail = localStorage.getItem('pendingUpgradeEmail');
          const sessionEmail = session.user.email;

          if (pendingEmail && sessionEmail && pendingEmail.toLowerCase() === sessionEmail.toLowerCase()) {
            await client.auth.updateUser({
              data: { status: 'active', plan: 'pro' }
            });
            try {
              await client.from('users').upsert({
                id: session.user.id,
                email: sessionEmail,
                status: 'active',
                plan: 'pro',
                updated_at: new Date().toISOString()
              });
            } catch (e) { console.warn("Upsert failed", e); }
            localStorage.removeItem('pendingUpgradeEmail');
          }
          await fetchUserProfile(session.user.id, session.user.email || '');
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  // Check for Payment Success URL Param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' || params.get('payment_success') === 'true') {
      setCurrentView('payment_success');
      // Clean URL but keep view state
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  const isLimitReached = (user?.status !== 'active') && (usageCount >= MAX_FREE_QUOTES);
  const quotesRemaining = user?.status === 'active' ? 9999 : Math.max(0, MAX_FREE_QUOTES - usageCount);

  const handleUpgradeClick = () => {
    setShowEmailModal(true);
  };

  // UPDATED: now accepts email + password and stores both
  const handleEmailSubmit = (email: string, password: string) => {
    localStorage.setItem('pendingUpgradeEmail', email);
    localStorage.setItem('pendingUpgradePassword', password);
    setShowEmailModal(false);
    window.open(STRIPE_LINKS.monthly, '_blank');
  };

  const handleGenerateClick = async () => {
    if (isLimitReached) {
      handleUpgradeClick();
      return;
    }

    if (apiKeyMissing) {
      setError("API Key is missing. Please configure it in your deployment settings.");
      return;
    }
    if (!zipCode.trim()) {
      setError("Please enter a Zip Code.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please provide a job description.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const quoteData = await generateQuote(industry, jobDescription, zipCode);

      if (user?.status !== 'active') {
        const newCount = usageCount + 1;
        setUsageCount(newCount);
        localStorage.setItem('quoteUsageCount', newCount.toString());
      }

      const newHistoryItem: HistoryItem = {
        ...quoteData,
        id: Date.now().toString(),
        timestamp: Date.now(),
        industry: industry,
        jobDescription: jobDescription,
        zipCode: zipCode,
      };

      const updatedHistory = [newHistoryItem, ...history];
      setHistory(updatedHistory);
      localStorage.setItem('quoteHistory', JSON.stringify(updatedHistory));

      if (user && supabase) {
        const client = supabase!;
        await client.from('quotes').insert({
          user_id: user.id,
          industry: industry,
          job_description: jobDescription,
          zip_code: zipCode,
          result: quoteData
        });
      }

      setResult(quoteData);
    } catch (err) {
      console.error(err);
      setError("Something went wrong generating the quote. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (email: string, password?: string) => {
    if (supabase && password) {
      const client = supabase!;
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setCurrentView('landing');
    } else {
      // Demo Mode
      await new Promise(resolve => setTimeout(resolve, 1000));
      const existingUserStr = localStorage.getItem(`user_${email}`);
      let userData: User;
      if (existingUserStr) {
        userData = JSON.parse(existingUserStr);
      } else {
        userData = {
          id: `local_${Date.now()}`,
          email,
          plan: 'pro',
          status: 'trial',
          trialStartDate: Date.now()
        };
        localStorage.setItem(`user_${email}`, JSON.stringify(userData));
      }
      setUser(userData);
      localStorage.setItem('quoteGenUser', JSON.stringify(userData));
      setCurrentView('landing');
    }
  };

  const handleResetPassword = async (email: string) => {
    if (supabase) {
      const client = supabase!;
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    }
  };

  const handleUpdatePassword = async (password: string) => {
    if (supabase) {
      const client = supabase!;
      const { error } = await client.auth.updateUser({ password: password });
      if (error) throw error;
    }
  };

  // UPDATED: now takes email + password (not passwordless)
  const handlePaymentSuccessActivation = useCallback(async (
    email: string,
    password: string
  ): Promise<{ result: 'success' | 'existing_user' | 'email_confirmation_required' | 'error', message?: string }> => {
    console.log('[activate] start', email);

    if (!supabase) {
      // DEMO MODE
      const newUser: User = {
        id: `local_paid_${Date.now()}`,
        email: email,
        plan: 'pro',
        status: 'active',
        trialStartDate: Date.now()
      };
      setUser(newUser);
      localStorage.setItem('quoteGenUser', JSON.stringify(newUser));
      setShowPaywallModal(false);
      console.log('[activate] DONE (demo mode)');
      return { result: 'success' };
    }

    const client = supabase!;

    try {
      // A) Check existing session
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      console.log('[activate] getSession', { sessionData, sessionError });

      if (sessionData?.session) {
        console.log('[activate] already have session, upgrading user');

        await client.auth.updateUser({ data: { status: 'active', plan: 'pro' } });

        const { error: upsertError } = await client.from('users').upsert({
          id: sessionData.session.user.id,
          email: sessionData.session.user.email,
          status: 'active',
          plan: 'pro',
          updated_at: new Date().toISOString(),
        });

        if (upsertError) {
          console.error('[activate] upsert error (existing session)', upsertError);
          throw upsertError;
        }

        await fetchUserProfile(sessionData.session.user.id, sessionData.session.user.email || '');
        localStorage.removeItem('pendingUpgradeEmail');
        console.log('[activate] DONE (existing session)');
        return { result: 'success' };
      }

      // B) Sign-up using the password they created in the modal
      console.log('[activate] signUp start', { email });

      const { data: signUpData, error: signUpError } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { status: 'active', plan: 'pro' }
        }
      });

      console.log('[activate] signUp result', { signUpData, signUpError });

      if (signUpError) {
        const msg = (signUpError.message || '').toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already exists') || signUpError.status === 422 || signUpError.status === 400) {
          console.log('[activate] existing user case');
          return { result: 'existing_user' };
        }
        console.error('[activate] signUp error (fatal)', signUpError);
        throw signUpError;
      }

      // Email confirmation required (no session yet)
      if (signUpData.user && !signUpData.session) {
        console.log('[activate] signUp successful but no session (email confirmation required)');
        return { result: 'email_confirmation_required' };
      }

      if (!signUpData?.user || !signUpData.session) {
        console.error('[activate] signUp returned no user or session', signUpData);
        throw new Error('Signup returned no session');
      }

      // C) Upsert profile row
      const { error: upsertError } = await client.from('users').upsert({
        id: signUpData.user.id,
        email: email,
        status: 'active',
        plan: 'pro',
        updated_at: new Date().toISOString()
      });
      console.log('[activate] upsert result', { upsertError });

      if (upsertError) {
        console.error('[activate] upsert error', upsertError);
        throw upsertError;
      }

      await fetchUserProfile(signUpData.user.id, email);
      localStorage.removeItem('pendingUpgradeEmail');
      console.log('[activate] DONE (new signup)');
      return { result: 'success' };

    } catch (err: any) {
      console.error('[activate] UNHANDLED ERROR', err);
      return { result: 'existing_user' };
    }
  }, [fetchUserProfile]);

  const handleLogout = async () => {
    if (supabase) {
      const client = supabase!;
      await client.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('quoteGenUser');
    setCurrentView('landing');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    if (supabase && user?.id) {
      const client = supabase!;
      await client.from('users').update({
        company_name: updatedUser.companyName,
        company_phone: updatedUser.companyPhone,
        company_address: updatedUser.companyAddress
      }).eq('id', user.id);
    } else {
      localStorage.setItem('quoteGenUser', JSON.stringify(updatedUser));
    }
  };

  // --- VIEWS ---

  if (currentView === 'reset_password') {
    return <ResetPasswordPage onSuccess={() => {
      window.history.replaceState(null, '', '/');
      setCurrentView('landing');
    }} />;
  }

  if (currentView === 'payment_success') {
    return (
      <PaymentSuccessPage
        user={user}
        onActivate={handlePaymentSuccessActivation}
      />
    );
  }

  if (currentView === 'login') {
    return (
      <>
        <EmailCaptureModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          onSubmit={handleEmailSubmit}
          initialEmail={user?.email}
        />
        <LoginPage
          onAuth={handleAuth}
          onResetPassword={handleResetPassword}
          onBack={() => setCurrentView('landing')}
          onUpgrade={handleUpgradeClick}
        />
      </>
    );
  }

  if (currentView === 'billing') {
    return (
      <BillingPortal
        user={user}
        onBack={() => setCurrentView('landing')}
        onLogout={handleLogout}
        onUpdateUser={handleUpdateUser}
        onUpdatePassword={handleUpdatePassword}
      />
    );
  }

  // --- LANDING PAGE ---

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    setMobileMenuOpen(false);
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">

      <EmailCaptureModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSubmit={handleEmailSubmit}
        initialEmail={user?.email}
      />

      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <BrandLogo />
              <span className="ml-3 font-bold text-xl tracking-tight text-slate-900">Instant <span className="text-indigo-600">Quote Generator</span></span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <button type="button" onClick={() => scrollToSection(featuresRef)} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">How it works</button>
              <button type="button" onClick={() => scrollToSection(pricingRef)} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Pricing</button>
              <button type="button" onClick={() => setShowHistoryModal(true)} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1">
                <History size={16} /> History
              </button>

              {user ? (
                <button type="button" onClick={() => setCurrentView('billing')} className="flex items-center gap-2 pl-4 border-l border-slate-200 hover:opacity-80 transition-opacity">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-transparent hover:ring-indigo-200 transition-all ${user.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                    {user.email.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-slate-900 leading-none">Account</span>
                    <span className={`text-[10px] font-medium leading-none mt-0.5 ${user.status === 'active' ? 'text-indigo-600' : 'text-slate-500'}`}>
                      {user.status === 'active' ? 'Pro Plan' : 'Free Plan'}
                    </span>
                  </div>
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setCurrentView('login')} className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                    Log In
                  </button>
                  <button type="button" onClick={handleUpgradeClick} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all">
                    Get Unlimited Access
                  </button>
                </>
              )}
            </div>

            <div className="md:hidden">
              <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600">
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-4 shadow-lg">
            <button type="button" onClick={() => scrollToSection(featuresRef)} className="block w-full text-left text-sm font-medium text-slate-600">How it works</button>
            <button type="button" onClick={() => scrollToSection(pricingRef)} className="block w-full text-left text-sm font-medium text-slate-600">Pricing</button>
            <button type="button" onClick={() => setShowHistoryModal(true)} className="block w-full text-left text-sm font-medium text-slate-600 flex items-center gap-2">
              <History size={16} /> History
            </button>
            <div className="pt-4 border-t border-slate-100">
              {user ? (
                <button type="button" onClick={() => setCurrentView('billing')} className="w-full text-left text-sm font-bold text-indigo-600">
                  Manage Account
                </button>
              ) : (
                <div className="space-y-2">
                  <button type="button" onClick={() => setCurrentView('login')} className="block w-full text-center py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg">
                    Log In
                  </button>
                  <button type="button" onClick={handleUpgradeClick} className="block w-full text-center py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg">
                    Get Unlimited Access
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </nav>

      {/* --- rest of the landing page, result, features, pricing, footer, modals --- */}
      {/* (unchanged from your original, omitted here for brevity) */}

      {/* ...[everything below stays exactly as in your original file]... */}
    </div>
  );
};

export default App;

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
    if (typeof process !== 'undefined' && process.env.API_KEY === undefined) {
        // Check if we are in a browser env where process is not polyfilled fully
        // Usually vite handles this, but strict check prevents crash
    } else if (!process.env.API_KEY) {
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

  const handleEmailSubmit = (email: string) => {
      localStorage.setItem('pendingUpgradeEmail', email);
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

  // PLG FLOW: Passwordless Activation
  const handlePaymentSuccessActivation = useCallback(async (email: string): Promise<{ result: 'success' | 'existing_user' }> => {
      if (supabase) {
          const client = supabase!;

          try {
            // 1. Check if we already have a session
            const { data: sessionData } = await client.auth.getSession();
            
            if (sessionData.session) {
                 await client.auth.updateUser({ data: { status: 'active', plan: 'pro' } });
                 try {
                    await client.from('users').upsert({ 
                        id: sessionData.session.user.id,
                        email: sessionData.session.user.email,
                        status: 'active', 
                        plan: 'pro',
                        updated_at: new Date().toISOString()
                    });
                 } catch (e) { console.warn(e); }

                 await fetchUserProfile(sessionData.session.user.id, sessionData.session.user.email || '');
                 localStorage.removeItem('pendingUpgradeEmail');
                 setCurrentView('landing');
                 return { result: 'success' };
            }

            // 2. Not logged in. Attempt Passwordless Signup (Random Password)
            const randomPassword = `Pro-${Math.random().toString(36).slice(-8)}-${Date.now()}!`;
            
            const { data, error } = await client.auth.signUp({ 
                email, 
                password: randomPassword,
                options: {
                    data: { status: 'active', plan: 'pro' }
                }
            });

            if (error) {
                const isAlreadyRegistered = 
                    error.message.toLowerCase().includes('already registered') || 
                    error.status === 400 || 
                    error.status === 422;

                if (isAlreadyRegistered) {
                    return { result: 'existing_user' };
                }
                console.warn("Signup non-fatal error:", error);
                return { result: 'success' };
            }

            if (data.user) {
                if (data.session) {
                    try {
                        await client.from('users').upsert({ 
                            id: data.user.id, 
                            email: email,
                            status: 'active',
                            plan: 'pro'
                        });
                        await fetchUserProfile(data.user.id, email);
                    } catch (e) { console.warn(e); }
                }
                
                localStorage.removeItem('pendingUpgradeEmail'); 
                setCurrentView('landing');
                return { result: 'success' };
            }
            return { result: 'success' };

          } catch (e) {
              console.error("Activation exception:", e);
              // Fail gracefully
              return { result: 'success' };
          }

      } else {
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
          setCurrentView('landing');
          return { result: 'success' };
      }
  }, [fetchUserProfile, user]);

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
      return <PaymentSuccessPage user={user} onActivate={handlePaymentSuccessActivation} />;
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
                            {user.email.substring(0,2).toUpperCase()}
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

      <div className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-10">
                <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                    Generate Accurate Job Quotes <span className="text-indigo-600">in Seconds.</span>
                </h1>
                <p className="text-xl text-slate-500 mb-8 leading-relaxed">
                    Stop losing evenings to paperwork. Select your trade, describe the job, and get a clean, itemized estimate instantly.
                </p>
            </div>
            
            <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-900/10 border border-slate-200 p-6 sm:p-8 max-w-4xl mx-auto relative z-20">
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
                    <div className="md:col-span-8">
                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-200">1</div>
                            Select Trade
                        </label>
                        <IndustrySelector selected={industry} onSelect={setIndustry} disabled={isLoading} />
                    </div>

                    <div className="md:col-span-4">
                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-200">2</div>
                            Zip Code
                        </label>
                        <div className="relative group">
                            <MapPin size={18} className="absolute left-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="e.g. 90210" 
                                value={zipCode}
                                onChange={(e) => setZipCode(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all"
                                maxLength={5}
                            />
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-200">3</div>
                        Job Description
                    </label>
                    <div className="relative">
                        <textarea
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder={`Describe the project in detail for the most accurate quote...
Example: "Install 2000sqft asphalt shingle roof on a 1-story gable roof. Tear off existing layer. Include synthetic underlayment and new drip edge."`}
                            className="w-full h-40 p-5 bg-slate-50 border border-slate-200 rounded-2xl resize-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-base placeholder-slate-400 shadow-inner leading-relaxed"
                            disabled={isLoading}
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <div className="text-sm text-slate-500 flex items-center gap-2 order-2 sm:order-1">
                         {isLimitReached ? (
                             <span className="flex items-center gap-2 text-red-600 font-medium bg-red-50 px-3 py-1 rounded-full border border-red-100">
                                 <AlertCircle size={16} /> 
                                 Daily Limit Reached ({usageCount}/{MAX_FREE_QUOTES})
                             </span>
                         ) : (
                             <span className="flex items-center gap-2 text-slate-500">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                {quotesRemaining} free quotes remaining
                             </span>
                         )}
                    </div>
                    
                    <button
                        onClick={handleGenerateClick}
                        disabled={isLoading} 
                        className={`
                            order-1 sm:order-2 w-full sm:w-auto px-8 py-3.5 rounded-xl text-base font-bold text-white shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300
                        `}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} /> Generating Estimate...
                            </>
                        ) : isLimitReached ? (
                            <>Get Unlimited Access <ArrowRight size={18} /></>
                        ) : (
                            <>Generate Instant Quote <ArrowRight size={18} /></>
                        )}
                    </button>
                </div>
            </div>
            
            {error && (
                <div className="max-w-4xl mx-auto mt-6 animate-fade-in-up">
                    <div className="bg-red-50 border border-red-100 text-red-600 px-6 py-4 rounded-xl flex items-center gap-3 shadow-sm">
                        <AlertCircle size={20} className="shrink-0" />
                        <p className="font-medium">{error}</p>
                    </div>
                </div>
            )}
        </div>
        
        <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-b from-indigo-50 to-slate-50 -z-10"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-30 pointer-events-none">
             <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-200 rounded-full blur-3xl"></div>
             <div className="absolute top-1/2 -right-24 w-80 h-80 bg-blue-200 rounded-full blur-3xl"></div>
        </div>
      </div>

      {result && (
        <div ref={resultRef} className="bg-slate-50 py-16 relative">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                     <h2 className="text-3xl font-bold text-slate-900 mb-4">Your Estimate is Ready!</h2>
                     <p className="text-slate-500">
                        Based on market rates for <span className="font-bold text-slate-900">{zipCode || 'National Avg'}</span>. 
                        Review and edit the costs below before sending.
                     </p>
                </div>
                <QuoteResultCard result={result} user={user} />
            </div>
        </div>
      )}

      <div ref={featuresRef} className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need to win more jobs.</h2>
                <p className="text-lg text-slate-500">Built for contractors who want to spend less time quoting and more time building.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    {
                        icon: <Zap size={24} className="text-indigo-600" />,
                        title: "Instant Turnaround",
                        desc: "Generate detailed estimates in under 10 seconds while on the job site or in your truck."
                    },
                    {
                        icon: <MapPin size={24} className="text-indigo-600" />,
                        title: "Local Pricing",
                        desc: "AI analyzes local labor and material rates based on zip code to ensure competitive accuracy."
                    },
                    {
                        icon: <LayoutTemplate size={24} className="text-indigo-600" />,
                        title: "Professional Formatting",
                        desc: "Get a breakdown that looks professional and ready to text or email directly to your client."
                    }
                ].map((feature, i) => (
                    <div key={i} className="bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-100/50 transition-all group">
                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                            {feature.icon}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                        <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>
        </div>
      </div>

      <div ref={pricingRef} className="py-24 bg-slate-900 text-white relative overflow-hidden">
         <div className="absolute inset-0 opacity-20">
             <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
               <path d="M0 100 C 20 0 50 0 100 100 Z" fill="#0052CC" />
             </svg>
         </div>
         
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                 <div>
                     <h2 className="text-4xl font-bold mb-6">Simple, transparent pricing.</h2>
                     <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                         Save 10+ hours a week on paperwork. No contracts, cancel anytime.
                     </p>
                     <ul className="space-y-4 mb-10">
                         {[
                             "Unlimited Estimates",
                             "History Storage",
                             "Custom Company Branding",
                         ].map((item, i) => (
                             <li key={i} className="flex items-center gap-3 text-slate-300">
                                 <div className="bg-indigo-500 rounded-full p-1">
                                     <Check size={14} className="text-white" />
                                 </div>
                                 {item}
                             </li>
                         ))}
                     </ul>
                 </div>
                 
                 <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-black/50 relative">
                     <h3 className="text-2xl font-bold text-slate-900 mb-2">Pro Plan</h3>
                     <div className="flex items-baseline gap-1 mb-6">
                         <span className="text-5xl font-extrabold tracking-tight">$29</span>
                         <span className="text-slate-500 font-medium">/month</span>
                     </div>
                     <p className="text-slate-500 mb-8">
                         Everything you need to automate your quoting process and win more bids.
                     </p>
                     
                     <button 
                        onClick={handleUpgradeClick}
                        className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1 text-lg flex items-center justify-center gap-2"
                     >
                         Get Unlimited Access <ArrowRight size={20} />
                     </button>
                     <p className="text-center text-xs text-slate-400 mt-4">
                         Secure payment via Stripe.
                     </p>
                 </div>
             </div>
         </div>
      </div>

      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex items-center gap-2">
                        <BrandLogo />
                        <span className="font-bold text-lg text-slate-900">Instant Quote Generator</span>
                    </div>
                    <a href="mailto:support@instantquotegenerator.com" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">
                        Support: support@instantquotegenerator.com
                    </a>
                </div>
                <div className="text-slate-500 text-sm">
                    © {new Date().getFullYear()} Instant Quote Generator. All rights reserved.
                </div>
            </div>
        </div>
      </footer>

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2">
                        <History className="text-indigo-600" /> Quote History
                    </h3>
                    <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto p-6 space-y-4">
                    {history.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <History size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No history found. Generate your first quote!</p>
                        </div>
                    ) : (
                        history.map((item) => (
                            <div key={item.id} className="border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer bg-white group" 
                                onClick={() => {
                                    setResult(item);
                                    setIndustry(item.industry);
                                    setJobDescription(item.jobDescription);
                                    setZipCode(item.zipCode || '');
                                    setShowHistoryModal(false);
                                    setTimeout(() => {
                                        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }, 100);
                                }}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded uppercase">{item.industry}</span>
                                    <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-800 font-medium line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
                                    {item.jobDescription}
                                </p>
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <span className="text-xs font-bold text-slate-500">
                                        Est: ${item.priceRange.low.toLocaleString()} - ${item.priceRange.high.toLocaleString()}
                                    </span>
                                    <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

      {showPaywallModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 relative">
                  <button 
                    onClick={() => setShowPaywallModal(false)}
                    className="absolute top-4 right-4 p-2 bg-white/50 hover:bg-slate-100 rounded-full text-slate-500 transition-colors z-10"
                  >
                    <X size={20} />
                  </button>
                  
                  <div className="bg-indigo-600 p-8 text-center text-white relative overflow-hidden">
                      <div className="absolute inset-0 opacity-20">
                           <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                             <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                           </svg>
                      </div>
                      <div className="relative z-10">
                           <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-white/30">
                              <Zap size={32} className="text-white" />
                           </div>
                           <h2 className="text-2xl font-bold mb-2">Usage Limit Reached</h2>
                           <p className="text-indigo-100">
                               You've used all {MAX_FREE_QUOTES} free quotes for today.
                           </p>
                      </div>
                  </div>

                  <div className="p-8 text-center">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Upgrade for Unlimited Access</h3>
                      <ul className="text-left space-y-3 mb-8 max-w-xs mx-auto">
                          {[
                             "Unlimited AI Estimates",
                             "Save & Export History",
                             "Company Branding on Quotes"
                          ].map((feat, i) => (
                              <li key={i} className="flex items-center gap-3 text-slate-600">
                                  <Check size={16} className="text-green-500 shrink-0" />
                                  <span className="text-sm">{feat}</span>
                              </li>
                          ))}
                      </ul>
                      
                      <button 
                        onClick={handleUpgradeClick}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 mb-4"
                      >
                          Get Unlimited Access <ArrowRight size={18} />
                      </button>
                      
                      <p className="text-xs text-slate-400">
                          One-time setup. Cancel anytime.
                      </p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
import React, { useState, useEffect, useRef } from 'react';
import { generateQuote } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Industry, QuoteResult, HistoryItem, User } from './shared-types';
import { IndustrySelector } from './components/IndustrySelector';
import { QuoteResultCard } from './components/QuoteResultCard';
import { LoginPage } from './components/LoginPage';
import { BillingPortal } from './components/BillingPortal';
import { Loader2, AlertCircle, Zap, History, Check, Star, Shield, LayoutTemplate, Menu, X, ArrowRight, MapPin, Settings, Lock, Clock } from 'lucide-react';

const MAX_FREE_QUOTES = 3;
const TRIAL_DURATION_DAYS = 7;

type ViewState = 'landing' | 'login' | 'billing';
type BillingCycle = 'monthly' | 'yearly';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const resultRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);

  // Initialize
  useEffect(() => {
    if (!process.env.API_KEY) setApiKeyMissing(true);

    // 1. Initialize usage count from local storage
    const storedCount = localStorage.getItem('quoteUsageCount');
    if (storedCount) setUsageCount(parseInt(storedCount, 10));

    // 2. Load local history (fallback)
    const storedHistory = localStorage.getItem('quoteHistory');
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // 3. Check Auth: Supabase OR LocalStorage
    if (isSupabaseConfigured() && supabase) {
        // REAL MODE: Check Supabase Session
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) {
                await fetchUserProfile(session.user.id, session.user.email || '');
            }
        });
        
        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!session) {
                setUser(null);
            } else {
                 // Optionally refresh profile on change
                 if (!user || user.id !== session.user.id) {
                    await fetchUserProfile(session.user.id, session.user.email || '');
                 }
            }
        });
        return () => subscription.unsubscribe();

    } else {
        // DEMO MODE: Local Storage
        const storedUser = localStorage.getItem('quoteGenUser');
        if (storedUser) {
            try {
                const parsedUser: User = JSON.parse(storedUser);
                // Legacy fix: Ensure ID exists
                if (!parsedUser.id) parsedUser.id = 'local_' + Date.now();
                checkTrialStatus(parsedUser);
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        }
    }
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
      if (!supabase) return;

      try {
          // Fetch profile from 'users' table
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          if (data) {
              const u: User = {
                  id: data.id,
                  email: data.email || email,
                  plan: 'pro', // Assumed pro structure for now
                  status: data.status || 'trial',
                  trialStartDate: new Date(data.created_at).getTime(),
                  companyName: data.company_name,
                  companyPhone: data.company_phone,
                  companyAddress: data.company_address
              };
              checkTrialStatus(u);
          } else {
              // SELF-HEALING: Profile doesn't exist (Trigger failed or manual table creation)
              // Create the user row manually to ensure app works.
              console.log("User profile missing, creating entry...");
              
              const { error: insertError } = await supabase
                  .from('users')
                  .insert({
                      id: userId,
                      email: email,
                      status: 'trial', // Default to trial
                      // created_at is handled by default in SQL
                  });

              if (!insertError) {
                  // Set local state immediately assuming success
                  const fallbackUser: User = {
                      id: userId,
                      email: email,
                      plan: 'pro',
                      status: 'trial',
                      trialStartDate: Date.now()
                  };
                  checkTrialStatus(fallbackUser);
              } else {
                  console.error("Critical: Failed to create user profile.", insertError);
              }
          }
      } catch (err) {
          console.error("Unexpected error fetching profile:", err);
      }
  };

  // STRIPE LISTENER
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
        
        // Update status based on whether we are in Real or Demo mode
        if (isSupabaseConfigured() && supabase) {
             // REAL MODE: Update DB
             // We depend on 'user' being populated by the Auth Listener first.
             // Use non-null assertion because we checked isSupabaseConfigured
             supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
                 if (authUser) {
                     const { error } = await supabase
                        .from('users')
                        .update({ status: 'active' })
                        .eq('id', authUser.id);
                     
                     if (!error) {
                         // Refresh local state
                         await fetchUserProfile(authUser.id, authUser.email || '');
                         setCurrentView('billing');
                     } else {
                         console.error("Failed to activate subscription in DB:", error);
                     }
                 }
             });

        } else {
            // Demo Mode
            const storedUser = localStorage.getItem('quoteGenUser');
            if (storedUser) {
                const parsedUser: User = JSON.parse(storedUser);
                const updatedUser: User = { ...parsedUser, status: 'active' };
                setUser(updatedUser);
                localStorage.setItem('quoteGenUser', JSON.stringify(updatedUser));
                localStorage.setItem(`user_${updatedUser.email}`, JSON.stringify(updatedUser));
                setCurrentView('billing');
            }
        }
        // Clean URL to prevent re-triggering
        window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]); // Add user to dependency to capture update after auth load

  const checkTrialStatus = (userData: User) => {
    if (userData.status === 'active') {
        setUser(userData);
        return;
    }

    const now = Date.now();
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSinceStart = (now - userData.trialStartDate) / msPerDay;

    let updatedUser = { ...userData };

    if (daysSinceStart > TRIAL_DURATION_DAYS) {
        updatedUser.status = 'expired';
    } else {
        updatedUser.status = 'trial';
    }

    setUser(updatedUser);
    // Sync back to storage in Demo mode
    if (!isSupabaseConfigured()) {
        localStorage.setItem('quoteGenUser', JSON.stringify(updatedUser));
    }
  };

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  // --- LOGIC GATES ---
  const isGuestLimitReached = !user && usageCount >= MAX_FREE_QUOTES;
  const guestQuotesRemaining = Math.max(0, MAX_FREE_QUOTES - usageCount);
  const isTrialExpired = user?.status === 'expired';

  // Handlers
  const handleGenerateClick = async () => {
    if (isGuestLimitReached) {
        setCurrentView('login');
        return;
    }
    if (isTrialExpired) {
        setCurrentView('billing');
        return;
    }
    if (apiKeyMissing) {
      setError("API Key is missing. Please configure it in your deployment settings.");
      return;
    }
    if (!zipCode.trim()) {
      setError("Please enter a Zip Code. Rates vary significantly by location.");
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
      
      // Increment Guest Usage
      if (!user) {
          const newCount = usageCount + 1;
          setUsageCount(newCount);
          localStorage.setItem('quoteUsageCount', newCount.toString());
      }
      
      // Save History
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
      
      // Real DB Insert
      if (user && isSupabaseConfigured() && supabase) {
          const { error: dbError } = await supabase.from('quotes').insert({
              user_id: user.id,
              industry: industry,
              job_description: jobDescription,
              zip_code: zipCode,
              result: quoteData // Stores the full JSON
          });
          
          if (dbError) console.warn("Failed to save quote to database:", dbError);
      }

      setResult(quoteData);
    } catch (err) {
      console.error(err);
      setError("Something went wrong generating the quote. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (email: string, password?: string, isSignUp?: boolean) => {
      // HYBRID AUTH LOGIC
      
      if (isSupabaseConfigured() && supabase && password) {
          // REAL SUPABASE AUTH
          if (isSignUp) {
              const { error } = await supabase.auth.signUp({ email, password });
              if (error) throw error;
              // We don't need to manually insert here, because fetchUserProfile handles "missing user" check
              // when the session is established.
          } else {
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) throw error;
          }
          setCurrentView('landing');
      } else {
          // DEMO/LOCAL AUTH FALLBACK
          await new Promise(resolve => setTimeout(resolve, 1000)); // Fake delay
          
          const existingUserStr = localStorage.getItem(`user_${email}`);
          let userData: User;

          if (existingUserStr) {
              userData = JSON.parse(existingUserStr);
          } else {
              userData = {
                  id: `local_${Date.now()}`, // Generate pseudo-ID
                  email,
                  plan: 'pro',
                  status: 'trial',
                  trialStartDate: Date.now()
              };
              localStorage.setItem(`user_${email}`, JSON.stringify(userData));
          }
          
          checkTrialStatus(userData);
          localStorage.setItem('quoteGenUser', JSON.stringify(userData));
          setCurrentView('landing');
      }
  };

  const handleLogout = async () => {
      if (isSupabaseConfigured() && supabase) {
          await supabase.auth.signOut();
      }
      setUser(null);
      localStorage.removeItem('quoteGenUser');
      setCurrentView('landing');
  };

  const handleUpdateUser = async (updatedUser: User) => {
      setUser(updatedUser);
      
      if (isSupabaseConfigured() && supabase && user?.id) {
          // Update DB
          const { error } = await supabase
            .from('users')
            .update({
                company_name: updatedUser.companyName,
                company_phone: updatedUser.companyPhone,
                company_address: updatedUser.companyAddress
            })
            .eq('id', user.id);
          
          if (error) console.error("Failed to update settings", error);
      } else {
         // Local
         localStorage.setItem('quoteGenUser', JSON.stringify(updatedUser));
         localStorage.setItem(`user_${updatedUser.email}`, JSON.stringify(updatedUser));
      }
  };

  const handleActivateSubscription = () => {
      if (!user) return;
      // This is usually triggered by the Stripe callback, but if manual:
      const updatedUser: User = { ...user, status: 'active' };
      handleUpdateUser(updatedUser);
  };

  // Demo Mode for User Preview
  const handleDemoBilling = () => {
      const demoUser: User = {
          id: 'demo_dev_user',
          email: 'demo@instantquotegenerator.com',
          plan: 'pro',
          status: 'active',
          trialStartDate: Date.now() - (1000 * 60 * 60 * 24 * 3),
          companyName: 'Demo Construction LLC',
          companyPhone: '(555) 123-4567'
      };
      setUser(demoUser);
      setCurrentView('billing');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // View Router
  if (currentView === 'login') {
      return <LoginPage onAuth={handleAuth} onBack={() => setCurrentView('landing')} />;
  }

  if (currentView === 'billing') {
      return (
        <BillingPortal 
            user={user} 
            onBack={() => setCurrentView('landing')} 
            onLogout={handleLogout} 
            onActivate={handleActivateSubscription}
            onUpdateUser={handleUpdateUser}
            initialBillingCycle={billingCycle}
        />
      );
  }

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    setMobileMenuOpen(false);
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="bg-indigo-600 p-1.5 rounded-lg mr-2">
                <LayoutTemplate className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">Instant Quote <span className="text-indigo-600">Generator</span></span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection(featuresRef)} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">How it works</button>
              <button onClick={() => scrollToSection(pricingRef)} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Pricing</button>
              <button onClick={() => setShowHistoryModal(true)} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-1">
                <History size={16} /> History
              </button>
              
              {user ? (
                   <button onClick={() => setCurrentView('billing')} className="flex items-center gap-2 pl-4 border-l border-slate-200 hover:opacity-80 transition-opacity">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-transparent hover:ring-indigo-200 transition-all ${user.status === 'expired' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-700'}`}>
                            {user.email.substring(0,2).toUpperCase()}
                        </div>
                        <div className="flex flex-col items-start">
                             <span className="text-xs font-bold text-slate-900 leading-none">Account</span>
                             <span className={`text-[10px] font-medium leading-none mt-0.5 ${user.status === 'expired' ? 'text-red-500' : 'text-indigo-600'}`}>
                                {user.status === 'trial' ? 'Free Trial' : user.status === 'expired' ? 'Expired' : 'Pro Plan'}
                             </span>
                        </div>
                   </button>
              ) : (
                <>
                    <button onClick={() => setCurrentView('login')} className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                        Sign In
                    </button>
                    <button onClick={() => setCurrentView('login')} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all">
                        Get Unlimited
                    </button>
                </>
              )}
            </div>

            <div className="md:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600">
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-4 shadow-lg">
             <button onClick={() => scrollToSection(featuresRef)} className="block w-full text-left text-sm font-medium text-slate-600">How it works</button>
             <button onClick={() => scrollToSection(pricingRef)} className="block w-full text-left text-sm font-medium text-slate-600">Pricing</button>
             <button onClick={() => { setShowHistoryModal(true); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-medium text-slate-600">History</button>
             {user ? (
                 <button onClick={() => { setCurrentView('billing'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-bold text-indigo-600 flex items-center gap-2">
                     <Settings size={16} /> Manage Subscription
                 </button>
             ) : (
                 <button onClick={() => { setCurrentView('login'); setMobileMenuOpen(false); }} className="block w-full text-left text-sm font-bold text-indigo-600">Sign In</button>
             )}
          </div>
        )}
      </nav>

      {/* Hero & Tool Section */}
      <div className="relative pt-16 pb-20 lg:pt-24 lg:pb-28 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
              Turn Jobs Into Quotes <br/>
              <span className="text-indigo-600">in Seconds.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-500 mb-8 leading-relaxed">
              The fastest way for contractors to create professional estimates.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-slate-500 font-medium">
                <div className="flex items-center gap-1.5"><Check size={16} className="text-green-500" /> No Signup Required</div>
                <div className="flex items-center gap-1.5"><Check size={16} className="text-green-500" /> AI Powered</div>
                <div className="flex items-center gap-1.5"><Check size={16} className="text-green-500" /> Instant Results</div>
            </div>
          </div>

          {/* Main App Container - Styled like a Converter */}
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl shadow-indigo-100 border border-slate-200 overflow-hidden">
            {apiKeyMissing && (
              <div className="bg-amber-50 p-4 text-center border-b border-amber-100 text-amber-800 text-sm">
                 Warning: API Key is missing. The generator will not function.
              </div>
            )}

            {isTrialExpired && (
                 <div className="bg-red-50 p-4 text-center border-b border-red-100 text-red-800 text-sm font-medium flex justify-center items-center gap-2">
                    <Clock size={16} /> Your 7-day free trial has expired. Please upgrade to continue generating quotes.
                 </div>
            )}

            {/* Top Controls: Industry & Stats */}
            <div className="bg-slate-50 p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <IndustrySelector selected={industry} onSelect={setIndustry} disabled={isLoading || isTrialExpired} />
                  
                  {/* Location Input */}
                  <div className="relative w-full sm:w-32">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin size={14} className="text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="Zip Code*"
                      className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-full text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                      disabled={isLoading || isTrialExpired}
                    />
                  </div>
                </div>

                {/* Status Badge Logic */}
                <div className={`text-xs font-bold px-3 py-1 rounded-full border shadow-sm whitespace-nowrap ${
                    user 
                        ? (user.status === 'expired' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200') 
                        : 'bg-white text-slate-500 border-slate-200'
                }`}>
                    {user ? (
                        user.status === 'active' ? 'UNLIMITED PLAN' :
                        user.status === 'trial' ? 'FREE TRIAL ACTIVE' : 'TRIAL EXPIRED'
                    ) : `${guestQuotesRemaining} FREE ${guestQuotesRemaining === 1 ? 'QUOTE' : 'QUOTES'} LEFT`}
                </div>
            </div>

            {/* Main Input Area */}
            <div className="p-6 sm:p-8">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Job Description / Notes</label>
                <textarea 
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder={`e.g. "Install 500sqft of hardwood flooring in living room, remove old carpet, include baseboards."`}
                    className="w-full h-40 p-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none text-base disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={isLoading || isTrialExpired}
                />
                
                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <div className="mt-6">
                    {isLoading ? (
                        <button disabled className="w-full font-bold text-lg py-4 px-8 rounded-xl shadow-lg bg-indigo-600 text-white shadow-indigo-200 flex items-center justify-center gap-2 opacity-80 cursor-wait">
                            <Loader2 className="animate-spin" /> Analyzing...
                        </button>
                    ) : isGuestLimitReached ? (
                        <button onClick={() => setCurrentView('login')} className="w-full font-bold text-lg py-4 px-8 rounded-xl shadow-lg bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5">
                            <Lock size={20} /> Start 7-Day Free Trial
                        </button>
                    ) : isTrialExpired ? (
                        <button onClick={() => setCurrentView('billing')} className="w-full font-bold text-lg py-4 px-8 rounded-xl shadow-lg bg-red-600 hover:bg-red-700 text-white shadow-red-200 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5">
                            <Lock size={20} /> Unlock Unlimited Access
                        </button>
                    ) : (
                        <button onClick={handleGenerateClick} className="w-full font-bold text-lg py-4 px-8 rounded-xl shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5">
                            <Zap className="fill-current" /> Generate Quote
                        </button>
                    )}
                </div>
                
                {!user && usageCount > 0 && usageCount < MAX_FREE_QUOTES && (
                    <p className="text-center text-xs text-slate-400 mt-3">
                        No credit card required. {guestQuotesRemaining} free quotes remaining.
                    </p>
                )}
                {isGuestLimitReached && (
                     <p className="text-center text-xs text-slate-400 mt-3">
                        You've used your free guest quotes. Start a trial to continue.
                    </p>
                )}
            </div>
          </div>

          {/* Results Section */}
          {result && (
              <div ref={resultRef} className="max-w-4xl mx-auto mt-12">
                <div className="flex items-center gap-2 mb-6 justify-center">
                    <div className="h-px bg-slate-200 w-full"></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider whitespace-nowrap px-2">Your Estimate</span>
                    <div className="h-px bg-slate-200 w-full"></div>
                </div>
                <QuoteResultCard result={result} user={user} />
              </div>
          )}

        </div>
      </div>

      {/* Features Grid */}
      <div ref={featuresRef} className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-slate-900">Why Contractors Use Instant Quote Generator</h2>
                <p className="mt-4 text-slate-500 max-w-2xl mx-auto">Stop spending nights doing paperwork. Get 90% of the way there in 10 seconds.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
                {[
                    { title: "Instant Estimates", desc: "Powered by advanced AI to give you realistic price ranges based on US market data.", icon: <Zap size={24} className="text-indigo-600" /> },
                    { title: "Client-Ready Format", desc: "Generates professional text you can copy straight into an email or SMS.", icon: <Star size={24} className="text-indigo-600" /> },
                    { title: "Secure & Private", desc: "We don't store your client data. Your business stays your business.", icon: <Shield size={24} className="text-indigo-600" /> }
                ].map((feature, i) => (
                    <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                            {feature.icon}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                        <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div ref={pricingRef} className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-slate-900">Simple, Transparent Pricing</h2>
                <p className="mt-4 text-slate-500">Start for free, upgrade when you grow.</p>
            </div>

            {/* Billing Toggle */}
            <div className="flex justify-center mb-12">
                <div className="bg-slate-100 p-1 rounded-xl inline-flex relative">
                    <button 
                        onClick={() => setBillingCycle('monthly')}
                        className={`relative z-10 px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Monthly
                    </button>
                    <button 
                        onClick={() => setBillingCycle('yearly')}
                        className={`relative z-10 px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${billingCycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        Yearly <span className="text-xs text-green-600 font-bold ml-1">-15%</span>
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Free Tier */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 relative">
                    <h3 className="text-xl font-bold text-slate-900">Starter</h3>
                    <div className="mt-4 mb-6">
                        <span className="text-4xl font-extrabold text-slate-900">$0</span>
                        <span className="text-slate-500">/forever</span>
                    </div>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3 text-slate-600"><Check size={18} className="text-indigo-600" /> 3 Free Estimates</li>
                        <li className="flex items-center gap-3 text-slate-600"><Check size={18} className="text-indigo-600" /> Basic Cost Breakdown</li>
                        <li className="flex items-center gap-3 text-slate-600"><Check size={18} className="text-indigo-600" /> No Credit Card Required</li>
                    </ul>
                    <button disabled className="w-full py-3 px-6 rounded-xl bg-slate-100 text-slate-400 font-medium cursor-default">Included</button>
                </div>

                {/* Pro Tier */}
                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 relative shadow-2xl transform md:-translate-y-4">
                    {billingCycle === 'yearly' && (
                        <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">BEST VALUE</div>
                    )}
                    <h3 className="text-xl font-bold text-white">Professional</h3>
                    <div className="mt-4 mb-6">
                        <span className="text-4xl font-extrabold text-white">
                            {billingCycle === 'monthly' ? '$29' : '$299'}
                        </span>
                        <span className="text-slate-400">
                            /{billingCycle === 'monthly' ? 'month' : 'year'}
                        </span>
                    </div>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3 text-slate-300"><Check size={18} className="text-indigo-400" /> Unlimited Estimates</li>
                        <li className="flex items-center gap-3 text-slate-300"><Check size={18} className="text-indigo-400" /> Save & Export History</li>
                        <li className="flex items-center gap-3 text-slate-300"><Check size={18} className="text-indigo-400" /> Priority Processing</li>
                        <li className="flex items-center gap-3 text-slate-300"><Check size={18} className="text-indigo-400" /> Remove Watermarks</li>
                    </ul>
                    <button onClick={() => setCurrentView('login')} className="block w-full text-center py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-900/50">
                        Start 7-Day Free Trial
                    </button>
                    <p className="text-center text-slate-500 text-xs mt-4">Cancel anytime. No questions asked.</p>
                </div>
            </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
                {[
                    { q: "How accurate are the estimates?", a: "Estimates are based on average national data. They are excellent starting points but should always be verified against local material costs and labor rates." },
                    { q: "Is my data private?", a: "Yes. We do not store your client's details or the job descriptions on our servers permanently. History is stored locally on your device." },
                    { q: "Can I cancel my subscription?", a: "Absolutely. You can cancel anytime from your account settings. You'll keep access until the end of your billing period." },
                    { q: "Can I use this for any trade?", a: "Currently we support Roofing, HVAC, Plumbing, Electrical, and Painting. More trades are coming soon." }
                ].map((faq, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-2">{faq.q}</h3>
                        <p className="text-slate-600 text-sm">{faq.a}</p>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-4 opacity-50">
                <LayoutTemplate size={20} />
                <span className="font-bold text-lg">Instant Quote Generator</span>
            </div>
            <p className="text-slate-400 text-sm mb-8">© {new Date().getFullYear()} Instant Quote Generator. All rights reserved.</p>
            <div className="flex justify-center gap-6 text-sm text-slate-500">
                <a href="#" className="hover:text-indigo-600">Privacy Policy</a>
                <a href="#" className="hover:text-indigo-600">Terms of Service</a>
                <a href="#" className="hover:text-indigo-600">Contact</a>
            </div>
            
            {/* Developer Shortcuts */}
            <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                <button onClick={handleDemoBilling} className="text-xs text-slate-300 hover:text-indigo-500 transition-colors">
                    [Dev] Preview Billing Portal
                </button>
            </div>
        </div>
      </footer>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><History size={18} /> Quote History</h3>
                    <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={18} /></button>
                </div>
                <div className="overflow-y-auto p-4 space-y-3">
                    {history.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">No quotes generated yet.</div>
                    ) : (
                        history.map((item) => (
                            <div key={item.id} onClick={() => () => {
                                setIndustry(item.industry);
                                setJobDescription(item.jobDescription);
                                setZipCode(item.zipCode || '');
                                setResult(item);
                                setShowHistoryModal(false);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} className="p-4 rounded-xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all group">
                                <div className="flex justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold uppercase bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">{item.industry}</span>
                                      {item.zipCode && <span className="text-xs text-slate-400 flex items-center"><MapPin size={10} className="mr-0.5"/> {item.zipCode}</span>}
                                    </div>
                                    <span className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="text-sm font-medium text-slate-900 truncate mb-1">{item.jobDescription}</div>
                                <div className="text-xs text-indigo-600 font-semibold group-hover:text-indigo-700 flex items-center gap-1">
                                    View Estimate <ArrowRight size={12} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default App;
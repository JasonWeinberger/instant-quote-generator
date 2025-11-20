import React, { useState, useEffect, useRef } from 'react';
import { generateQuote } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Industry, QuoteResult, HistoryItem, User } from './shared-types';
import { IndustrySelector } from './components/IndustrySelector';
import { QuoteResultCard } from './components/QuoteResultCard';
import { LoginPage } from './components/LoginPage';
import { BillingPortal } from './components/BillingPortal';
import { Loader2, AlertCircle, Zap, History, Check, LayoutTemplate, Menu, X, ArrowRight, MapPin, Settings, Shield, AlertTriangle } from 'lucide-react';

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
  // Removed unused setBillingCycle to fix build error
  const [billingCycle] = useState<BillingCycle>('monthly');

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
             
             // Capture client locally to enforce non-null in closure
             const client = supabase!;
             
             client.auth.getUser().then(async ({ data: { user: authUser } }) => {
                 if (authUser) {
                     const { error } = await client
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
              const { error } = await supabase.auth.signUp({ 
                email, 
                password,
                options: {
                  // Fix: Ensure email redirects to the correct origin (e.g. port 5173)
                  emailRedirectTo: window.location.origin
                }
              });
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
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-xs font-bold text-indigo-600 mb-6 uppercase tracking-wider">
               <Zap size={14} fill="currentColor" /> AI-Powered Estimation
            </div>
            <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
              Accurate <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">Construction Quotes</span> in Seconds
            </h1>
            <p className="text-xl text-slate-500 mb-8">
              Stop spending hours on paperwork. Generate professional, itemized estimates for roofing, HVAC, and more instantly.
            </p>
          </div>

          {/* Main Card */}
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            <div className="p-8 sm:p-10">
              
              {!user && (
                 <div className="mb-8 flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-sm text-slate-600">
                        <span className="font-bold text-slate-900">{guestQuotesRemaining} free quotes</span> remaining
                    </div>
                    <div className="flex gap-1">
                        {[...Array(MAX_FREE_QUOTES)].map((_, i) => (
                            <div key={i} className={`h-2 w-8 rounded-full ${i < usageCount ? 'bg-slate-200' : 'bg-indigo-500'}`}></div>
                        ))}
                    </div>
                 </div>
              )}

              {apiKeyMissing && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center gap-3">
                   <AlertTriangle size={20} />
                   <span>System Error: API Key Not Configured.</span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Industry</label>
                  <IndustrySelector 
                    selected={industry} 
                    onSelect={setIndustry} 
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Job Details</label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="e.g. Replace asphalt shingle roof on 2,500 sq ft home. 4/12 pitch, 1 layer tear-off. Include new drip edge and ridge vent."
                    className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px] text-slate-900 placeholder-slate-400 resize-y transition-all"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Zip Code (For Local Rates)</label>
                  <div className="relative max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin size={18} className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        placeholder="e.g. 90210"
                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        disabled={isLoading}
                    />
                  </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-start gap-3">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                <button
                  onClick={handleGenerateClick}
                  disabled={isLoading || (isGuestLimitReached && !user) || isTrialExpired}
                  className={`
                    w-full py-4 px-6 rounded-xl font-bold text-lg shadow-lg transform transition-all hover:-translate-y-0.5
                    ${isLoading ? 'bg-slate-100 text-slate-400 cursor-wait shadow-none' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'}
                    ${((isGuestLimitReached && !user) || isTrialExpired) ? 'opacity-50 cursor-not-allowed hover:translate-y-0' : ''}
                    flex items-center justify-center gap-3
                  `}
                >
                  {isLoading ? (
                    <>
                        <Loader2 className="animate-spin" size={20} /> Generating Estimate...
                    </>
                  ) : (isGuestLimitReached && !user) ? (
                    <>Limit Reached - Sign In Free</>
                  ) : isTrialExpired ? (
                    <>Trial Expired - Upgrade Now</>
                  ) : (
                    <>
                        Generate Quote <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Footer of Card */}
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                    <Shield size={12} /> Private & Secure. We don't share your data.
                </p>
            </div>
          </div>
        </div>
      </div>

      {/* Result Section */}
      {result && (
          <div ref={resultRef} className="py-16 bg-slate-100 border-y border-slate-200">
              <div className="max-w-3xl mx-auto px-4">
                  <div className="mb-8 text-center">
                      <h2 className="text-3xl font-bold text-slate-900">Your Estimate is Ready</h2>
                      <p className="text-slate-500 mt-2">Review, edit, and copy this quote directly to your client.</p>
                  </div>
                  <QuoteResultCard result={result} user={user} />
              </div>
          </div>
      )}

      {/* Features Section */}
      <div ref={featuresRef} className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold text-slate-900">Built for Modern Contractors</h2>
                  <p className="text-slate-500 mt-4 max-w-2xl mx-auto">
                      Stop guessing prices. Our AI analyzes thousands of local data points to give you accurate, competitive estimates in seconds.
                  </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                  {[
                      {
                          title: "Local Pricing Engine",
                          desc: "Rates are adjusted based on the specific zip code provided.",
                          icon: <MapPin size={24} className="text-indigo-600" />
                      },
                      {
                          title: "Client-Ready Text",
                          desc: "Get a professionally written message ready to copy/paste into SMS or Email.",
                          icon: <Check size={24} className="text-indigo-600" />
                      },
                      {
                          title: "Itemized Breakdowns",
                          desc: "Clear separation of materials, labor, and overhead costs.",
                          icon: <LayoutTemplate size={24} className="text-indigo-600" />
                      }
                  ].map((feature, i) => (
                      <div key={i} className="p-8 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors">
                          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6">
                              {feature.icon}
                          </div>
                          <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                          <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* Pricing Section */}
      <div ref={pricingRef} className="py-24 bg-slate-900 text-white">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
             <div className="text-center mb-16">
                 <h2 className="text-3xl font-bold">Simple, Transparent Pricing</h2>
                 <p className="text-slate-400 mt-4">Start with a free trial. Cancel anytime.</p>
             </div>

             <div className="max-w-lg mx-auto bg-slate-800 rounded-3xl border border-slate-700 p-8 sm:p-12 relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                     Best Value
                 </div>
                 <div className="text-center mb-8">
                     <h3 className="text-xl font-medium text-slate-300">Pro Contractor</h3>
                     <div className="mt-4 flex items-baseline justify-center gap-1">
                         <span className="text-5xl font-bold text-white">$29</span>
                         <span className="text-slate-400">/mo</span>
                     </div>
                     <p className="text-slate-400 mt-4 text-sm">Everything you need to scale your business.</p>
                 </div>

                 <ul className="space-y-4 mb-8">
                     {[
                         "Unlimited AI Quotes",
                         "Save & Export History",
                         "Custom Company Branding",
                         "Priority Support",
                         "7-Day Free Trial"
                     ].map((item, i) => (
                         <li key={i} className="flex items-center gap-3 text-slate-300">
                             <Check size={18} className="text-indigo-400" /> {item}
                         </li>
                     ))}
                 </ul>

                 <button 
                    onClick={() => user ? setCurrentView('billing') : setCurrentView('login')}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-900/50"
                 >
                     {user ? 'Manage Subscription' : 'Start 7-Day Free Trial'}
                 </button>
                 <p className="text-center text-xs text-slate-500 mt-4">No credit card required for demo.</p>
             </div>
         </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                          <History size={20} className="text-slate-400" /> Quote History
                      </h3>
                      <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={24} />
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {history.length === 0 ? (
                          <div className="text-center py-12 text-slate-400">
                              <p>No quotes generated yet.</p>
                          </div>
                      ) : (
                          history.map((item) => (
                              <div key={item.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">
                                              {item.industry}
                                          </span>
                                          <span className="ml-2 text-xs text-slate-400">
                                              {new Date(item.timestamp).toLocaleDateString()}
                                          </span>
                                      </div>
                                      <div className="text-right font-bold text-slate-900">
                                          ${item.priceRange.low.toLocaleString()} - ${item.priceRange.high.toLocaleString()}
                                      </div>
                                  </div>
                                  <p className="text-sm text-slate-600 line-clamp-2 mb-3">{item.jobDescription}</p>
                                  <button 
                                    onClick={() => {
                                        setResult(item);
                                        setIndustry(item.industry);
                                        setJobDescription(item.jobDescription);
                                        setZipCode(item.zipCode || '');
                                        setShowHistoryModal(false);
                                    }}
                                    className="text-xs font-bold text-indigo-600 hover:underline"
                                  >
                                      Load Quote
                                  </button>
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
import React, { useState, useEffect, useRef } from 'react';
import { generateQuote } from './services/geminiService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Industry, QuoteResult, HistoryItem, User } from './shared-types';
import { IndustrySelector } from './components/IndustrySelector';
import { QuoteResultCard } from './components/QuoteResultCard';
import { LoginPage } from './components/LoginPage';
import { BillingPortal } from './components/BillingPortal';
import { PaymentSuccessPage } from './components/PaymentSuccessPage';
import { STRIPE_LINKS } from './constants';
import { Loader2, AlertCircle, Zap, History, Check, LayoutTemplate, Menu, X, ArrowRight, MapPin, Settings, Shield, AlertTriangle, Lock } from 'lucide-react';

const MAX_FREE_QUOTES = 3;

type ViewState = 'landing' | 'login' | 'billing' | 'payment_success';
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
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  
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
                setUser(parsedUser);
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        }
    }
  }, []);

  // Check for Payment Success URL Param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true') {
        setCurrentView('payment_success');
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
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
              setUser(u);
          }
      } catch (err) {
          console.error("Unexpected error fetching profile:", err);
      }
  };

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  // --- LOGIC GATES ---
  // Limit reached if: User is NOT active AND usage >= limit
  const isLimitReached = (user?.status !== 'active') && (usageCount >= MAX_FREE_QUOTES);
  const quotesRemaining = user?.status === 'active' ? 9999 : Math.max(0, MAX_FREE_QUOTES - usageCount);

  // Handlers
  const handleGenerateClick = async () => {
    if (isLimitReached) {
        setShowPaywallModal(true);
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
      
      // Increment Usage for non-active users
      if (user?.status !== 'active') {
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
              result: quoteData
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
      if (isSupabaseConfigured() && supabase && password) {
          if (isSignUp) {
              // Force standard localhost URL if running locally
              let redirectUrl = window.location.origin;
              if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                  redirectUrl = 'http://localhost:3000'; 
              }

              const { data, error } = await supabase.auth.signUp({ 
                email, 
                password,
                options: { emailRedirectTo: redirectUrl }
              });
              if (error) throw error;
              if (data.user && !data.session) return { requiresConfirmation: true };
          } else {
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) throw error;
          }
          setCurrentView('landing');
      } else {
          // DEMO/LOCAL AUTH
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

  const handlePaymentSuccessAuth = async (email: string, password: string) => {
      if (isSupabaseConfigured() && supabase) {
          // 1. Create Account
          const { data, error } = await supabase.auth.signUp({ 
              email, 
              password 
          });
          
          if (error) throw error;

          // 2. Ensure User Entry Exists & Set Active
          if (data.user) {
             const { error: updateError } = await supabase
                .from('users')
                .upsert({ 
                    id: data.user.id, 
                    email: email,
                    status: 'active' // CRITICAL: Set active immediately
                });
             
             if (updateError) throw updateError;

             // 3. Sign In immediately if session not established (some flows might need explicit sign in)
             if (!data.session) {
                 const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                 if (signInError) throw signInError;
             }

             // 4. Fetch and Update Local State
             await fetchUserProfile(data.user.id, email);
             setCurrentView('billing'); // Go to dashboard
          }
      } else {
          // DEMO MODE MOCK
          const newUser: User = {
              id: `local_paid_${Date.now()}`,
              email,
              plan: 'pro',
              status: 'active',
              trialStartDate: Date.now()
          };
          setUser(newUser);
          localStorage.setItem('quoteGenUser', JSON.stringify(newUser));
          setCurrentView('billing');
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
         localStorage.setItem('quoteGenUser', JSON.stringify(updatedUser));
         localStorage.setItem(`user_${updatedUser.email}`, JSON.stringify(updatedUser));
      }
  };

  const handleStripeRedirect = () => {
    window.location.href = STRIPE_LINKS.monthly;
  };

  // View Router
  if (currentView === 'payment_success') {
      return <PaymentSuccessPage onComplete={handlePaymentSuccessAuth} />;
  }

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
                    <button onClick={() => setCurrentView('login')} className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                        Sign In
                    </button>
                    <button onClick={handleStripeRedirect} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all">
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
             <button onClick={() => setShowHistoryModal(true)} className="block w-full text-left text-sm font-medium text-slate-600 flex items-center gap-2">
                 <History size={16} /> History
             </button>
             <div className="pt-4 border-t border-slate-100">
                 {user ? (
                     <button onClick={() => setCurrentView('billing')} className="w-full text-left text-sm font-bold text-indigo-600">
                         Manage Account
                     </button>
                 ) : (
                    <div className="space-y-2">
                        <button onClick={() => setCurrentView('login')} className="block w-full text-center py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg">
                            Sign In
                        </button>
                        <button onClick={handleStripeRedirect} className="block w-full text-center py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg">
                            Get Unlimited
                        </button>
                    </div>
                 )}
             </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-12">
                <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium mb-6 border border-indigo-100">
                    <Zap size={14} fill="currentColor" /> AI-Powered Estimates
                </div>
                <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                    Generate accurate construction quotes <span className="text-indigo-600">in seconds.</span>
                </h1>
                <p className="text-xl text-slate-500 mb-8 leading-relaxed">
                    Stop spending nights on paperwork. Select your trade, describe the job, and get a detailed, itemized estimate instantly.
                </p>
                
                {/* Input Area */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-2 sm:p-4 max-w-2xl mx-auto transform transition-all hover:shadow-2xl hover:border-indigo-200">
                    
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-4 px-2">
                        <IndustrySelector selected={industry} onSelect={setIndustry} disabled={isLoading} />
                        <div className="w-full sm:w-32 mt-2 sm:mt-0">
                           <input 
                              type="text" 
                              placeholder="Zip Code" 
                              value={zipCode}
                              onChange={(e) => setZipCode(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                              maxLength={5}
                           />
                        </div>
                    </div>
                    
                    <div className="relative">
                        <textarea
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            placeholder={`Describe the job (e.g., "Install 2000sqft asphalt shingle roof on 1-story home, tear off old layer, include flashing")`}
                            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-base placeholder-slate-400"
                            disabled={isLoading}
                        />
                        <div className="absolute bottom-3 right-3 flex items-center gap-3">
                            {isLimitReached && (
                                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded border border-red-100">
                                    Limit Reached
                                </span>
                            )}
                            {!isLimitReached && (
                                <span className="text-xs font-medium text-slate-400">
                                    {quotesRemaining} free quotes left
                                </span>
                            )}
                            <button
                                onClick={handleGenerateClick}
                                disabled={isLoading}
                                className={`
                                    flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition-all shadow-lg hover:shadow-xl
                                    ${isLoading ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5'}
                                `}
                            >
                                {isLoading ? (
                                    <><Loader2 className="animate-spin" size={18} /> Analyzing...</>
                                ) : (
                                    <>Generate Quote <ArrowRight size={18} /></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {error && (
                <div className="max-w-2xl mx-auto mb-8 animate-fade-in-up">
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
                        <AlertCircle className="text-red-500 mt-0.5" size={20} />
                        <div>
                            <h3 className="text-red-800 font-bold">Error</h3>
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Result Section */}
            <div ref={resultRef} className="max-w-3xl mx-auto">
                {result && <QuoteResultCard result={result} user={user} />}
            </div>

        </div>
      </div>

      {/* Features Section */}
      <div ref={featuresRef} className="bg-white py-24 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold text-slate-900">Built for Tradespeople</h2>
                  <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
                      Simple enough to use in the truck, powerful enough to run your business.
                  </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-8">
                  {[
                      { icon: <Zap size={24} />, title: "Instant Speed", desc: "Get a baseline estimate in under 10 seconds based on local market rates." },
                      { icon: <Settings size={24} />, title: "Fully Editable", desc: "Adjust materials, labor, and overhead costs to match your exact needs." },
                      { icon: <MapPin size={24} />, title: "Localized Pricing", desc: "Estimates adjust based on the zip code provided for accurate labor rates." }
                  ].map((feature, i) => (
                      <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-colors">
                          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                              {feature.icon}
                          </div>
                          <h3 className="font-bold text-lg text-slate-900 mb-2">{feature.title}</h3>
                          <p className="text-slate-600">{feature.desc}</p>
                      </div>
                  ))}
              </div>
          </div>
      </div>

      {/* Pricing Section */}
      <div ref={pricingRef} className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-slate-900">Simple Pricing</h2>
                  <p className="mt-4 text-lg text-slate-500">Start for free, upgrade when you grow.</p>
              </div>
              
              <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-center">
                  {/* Free Plan */}
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all relative overflow-hidden">
                      <h3 className="text-xl font-bold text-slate-900">Starter</h3>
                      <div className="mt-4 flex items-baseline text-slate-900">
                          <span className="text-4xl font-extrabold tracking-tight">$0</span>
                          <span className="ml-1 text-xl font-semibold text-slate-500">/forever</span>
                      </div>
                      <p className="mt-4 text-slate-500">Perfect for testing the waters.</p>
                      
                      <ul className="mt-6 space-y-4">
                          <li className="flex items-center gap-3 text-slate-600">
                              <Check size={18} className="text-green-500" /> 3 Free Estimates
                          </li>
                          <li className="flex items-center gap-3 text-slate-600">
                              <Check size={18} className="text-green-500" /> All Industries
                          </li>
                          <li className="flex items-center gap-3 text-slate-600">
                              <Check size={18} className="text-green-500" /> Localized Pricing
                          </li>
                      </ul>
                  </div>

                  {/* Pro Plan */}
                  <div className="bg-slate-900 p-8 rounded-2xl shadow-2xl transform md:scale-105 relative overflow-hidden text-white">
                      <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                      <h3 className="text-xl font-bold">Pro Unlimited</h3>
                      <div className="mt-4 flex items-baseline">
                          <span className="text-4xl font-extrabold tracking-tight">$29</span>
                          <span className="ml-1 text-xl font-semibold text-slate-400">/mo</span>
                      </div>
                      <p className="mt-4 text-slate-400">For professional contractors.</p>
                      
                      <ul className="mt-6 space-y-4">
                          <li className="flex items-center gap-3 text-slate-300">
                              <Check size={18} className="text-indigo-400" /> Unlimited Estimates
                          </li>
                          <li className="flex items-center gap-3 text-slate-300">
                              <Check size={18} className="text-indigo-400" /> Save History to Cloud
                          </li>
                          <li className="flex items-center gap-3 text-slate-300">
                              <Check size={18} className="text-indigo-400" /> Custom Branding (Logo/Phone)
                          </li>
                          <li className="flex items-center gap-3 text-slate-300">
                              <Check size={18} className="text-indigo-400" /> Priority Support
                          </li>
                      </ul>

                      <button onClick={handleStripeRedirect} className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-900/50">
                          Get Unlimited Access
                      </button>
                  </div>
              </div>
          </div>
      </div>

      {/* Paywall Modal */}
      {showPaywallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-up">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                <button onClick={() => setShowPaywallModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={20} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Limit Reached</h2>
                    <p className="text-slate-500">
                        You've used your 3 free quotes. Upgrade to Pro to generate unlimited estimates and grow your business.
                    </p>
                </div>

                <div className="bg-indigo-50 rounded-xl p-4 mb-6 border border-indigo-100">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900">Pro Unlimited</span>
                        <span className="font-bold text-indigo-700">$29<span className="text-sm font-normal text-indigo-500">/mo</span></span>
                    </div>
                    <ul className="text-sm text-slate-600 space-y-2">
                        <li className="flex items-center gap-2"><Check size={14} className="text-indigo-500"/> Unlimited AI Quotes</li>
                        <li className="flex items-center gap-2"><Check size={14} className="text-indigo-500"/> Company Branding</li>
                        <li className="flex items-center gap-2"><Check size={14} className="text-indigo-500"/> Cloud History</li>
                    </ul>
                </div>

                <button 
                    onClick={handleStripeRedirect}
                    className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-200"
                >
                    Unlock Unlimited Access <ArrowRight size={18} />
                </button>
                
                <p className="text-center text-xs text-slate-400 mt-4">
                    Secure payment via Stripe. Cancel anytime.
                </p>
            </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <History size={20} className="text-indigo-600" /> Quote History
                    </h3>
                    <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="overflow-y-auto p-6 flex-1">
                    {history.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <History size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No quotes generated yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((item) => (
                                <div key={item.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer" onClick={() => {
                                    setResult(item);
                                    setIndustry(item.industry);
                                    setJobDescription(item.jobDescription);
                                    setZipCode(item.zipCode || '');
                                    setShowHistoryModal(false);
                                }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded uppercase">
                                            {item.industry}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-900 line-clamp-2 mb-2">
                                        {item.jobDescription}
                                    </p>
                                    <div className="text-xs text-slate-500">
                                        Est: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.priceRange.low)} - {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.priceRange.high)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
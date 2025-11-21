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
import { Loader2, AlertCircle, Zap, History, Check, LayoutTemplate, Menu, X, ArrowRight, MapPin, Settings, Lock } from 'lucide-react';

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
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!session) {
                setUser(null);
            } else if (event === 'SIGNED_IN') {
                 // Explicitly handle sign-in redirect if needed, or just state update
                 // If coming from email link, session is now active
                 if (!user || user.id !== session.user.id) {
                    await fetchUserProfile(session.user.id, session.user.email || '');
                 }
            } else if (event === 'PASSWORD_RECOVERY') {
                 // When user clicks reset link, they are signed in. Redirect to settings to change password.
                 setCurrentView('billing'); 
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

  // Check for Payment Success URL Param (Supports both 'payment_success' and 'success')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // We prioritize 'success' as per the new instruction, but keep 'payment_success' for backward compat if needed
    if (params.get('success') === 'true' || params.get('payment_success') === 'true') {
        setCurrentView('payment_success');
        // Clean URL so a refresh doesn't trigger it again
        window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchUserProfile = async (userId: string, email: string) => {
      if (!supabase) return;

      try {
          // Fetch profile from 'users' table
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

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
          } else {
              // If no profile exists (new signup without trigger), create a default local state
              const newUser: User = {
                  id: userId,
                  email: email,
                  plan: 'starter',
                  status: 'trial',
                  trialStartDate: Date.now()
              };
              setUser(newUser);
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
              const { data, error } = await supabase.auth.signUp({ 
                email, 
                password
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

  const handleResetPassword = async (email: string) => {
      if (isSupabaseConfigured() && supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin,
          });
          if (error) throw error;
      } else {
          // DEMO
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log(`Password reset requested for ${email}`);
      }
  };

  const handleUpdatePassword = async (password: string) => {
      if (isSupabaseConfigured() && supabase) {
          const { error } = await supabase.auth.updateUser({ password: password });
          if (error) throw error;
      } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
      }
  };

  const handlePaymentSuccessActivation = async (email?: string, password?: string) => {
      if (isSupabaseConfigured() && supabase) {
          let userId = user?.id;

          // 1. If not logged in, try to Authenticate (Sign Up or Sign In)
          if (!userId && email && password) {
              // Attempt Sign Up first (Assumption: New user coming from Stripe)
              const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ 
                email, 
                password 
              });

              if (signUpData.user && signUpData.session) {
                  // Success: New user created and logged in
                  userId = signUpData.user.id;
              } else if (signUpData.user && !signUpData.session) {
                  // User created but needs confirmation
                  throw new Error("Account created! Please check your email to confirm, then log in.");
              } else if (signUpError) {
                  // If error indicates user exists, try logging in
                  if (signUpError.message.toLowerCase().includes('already registered') || signUpError.status === 422 || signUpError.status === 400) {
                       const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                       if (signInError) throw new Error("Account already exists, but password was incorrect.");
                       if (signInData.user) userId = signInData.user.id;
                  } else {
                      throw signUpError;
                  }
              }
          }

          if (!userId) throw new Error("Authentication failed. Please try again.");

          // 2. Update User Status to Active in DB
          const { error: updateError } = await supabase
            .from('users')
            .upsert({ 
                id: userId, 
                status: 'active',
                email: email || user?.email
            });
             
          if (updateError) throw updateError;

          // 3. Refresh Profile state
          await fetchUserProfile(userId, email || user?.email || '');
          
      } else {
          // DEMO MODE MOCK
          if (user) {
            const updatedUser: User = { ...user, status: 'active' };
            setUser(updatedUser);
            localStorage.setItem('quoteGenUser', JSON.stringify(updatedUser));
          } else if (email) {
               const newUser: User = {
                  id: `local_paid_${Date.now()}`,
                  email,
                  plan: 'pro',
                  status: 'active',
                  trialStartDate: Date.now()
              };
              setUser(newUser);
              localStorage.setItem('quoteGenUser', JSON.stringify(newUser));
          }
      }
      
      // 4. Cleanup and Redirect
      localStorage.removeItem('pendingUpgrade'); // Clear the upgrade flag
      setShowPaywallModal(false);
      setCurrentView('landing');
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
    // Redirect to Stripe immediately
    window.location.href = STRIPE_LINKS.monthly;
  };

  const handleUpgradeClick = () => {
      // Direct to payment immediately
      handleStripeRedirect();
  };

  // View Router
  if (currentView === 'payment_success') {
      return <PaymentSuccessPage user={user} onActivate={handlePaymentSuccessActivation} />;
  }

  if (currentView === 'login') {
      return (
        <LoginPage 
            onAuth={handleAuth} 
            onResetPassword={handleResetPassword}
            onBack={() => setCurrentView('landing')} 
        />
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
                    <button onClick={handleUpgradeClick} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all">
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
                        <button onClick={handleUpgradeClick} className="block w-full text-center py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg">
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
            <div className="text-center max-w-3xl mx-auto mb-10">
                <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium mb-6 border border-indigo-100">
                    <Zap size={14} fill="currentColor" /> AI-Powered Estimates
                </div>
                <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
                    Generate accurate construction quotes <span className="text-indigo-600">in seconds.</span>
                </h1>
                <p className="text-xl text-slate-500 mb-8 leading-relaxed">
                    Stop spending nights on paperwork. Select your trade, describe the job, and get a detailed, itemized estimate instantly.
                </p>
            </div>
            
            {/* Input Area - IMPROVED UI */}
            <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-900/10 border border-slate-200 p-6 sm:p-8 max-w-4xl mx-auto relative z-20">
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-6">
                    {/* Step 1: Industry */}
                    <div className="md:col-span-8">
                        <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-200">1</div>
                            Select Trade
                        </label>
                        <IndustrySelector selected={industry} onSelect={setIndustry} disabled={isLoading} />
                    </div>

                    {/* Step 2: Zip Code */}
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

                {/* Step 3: Description */}
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

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <div className="text-sm text-slate-500 flex items-center gap-2 order-2 sm:order-1">
                         {/* Limit logic */}
                         {isLimitReached ? (
                             <span className="flex items-center gap-2 text-red-600 font-medium bg-red-50 px-3 py-1 rounded-full border border-red-100">
                                 <AlertCircle size={16} /> Limit Reached
                             </span>
                         ) : (
                             <span className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                 <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
                                 {quotesRemaining} free quotes remaining
                             </span>
                         )}
                    </div>

                    <button
                        onClick={handleGenerateClick}
                        disabled={isLoading}
                        className={`
                            order-1 sm:order-2 w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-white text-lg shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3
                            ${isLoading ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}
                        `}
                    >
                        {isLoading ? (
                            <><Loader2 className="animate-spin" size={20} /> Analyzing...</>
                        ) : (
                            <>Generate Estimate <ArrowRight size={20} /></>
                        )}
                    </button>
                </div>
            </div>
            
            {error && (
                <div className="max-w-2xl mx-auto mt-8 animate-fade-in-up">
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
            <div ref={resultRef} className="max-w-4xl mx-auto mt-12">
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

                      <button onClick={handleUpgradeClick} className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-900/50">
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
                    Proceed to Payment <ArrowRight size={18} />
                </button>
                
                <p className="text-center text-xs text-slate-400 mt-4">
                    Secure payment via Stripe. You'll create your account after payment.
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
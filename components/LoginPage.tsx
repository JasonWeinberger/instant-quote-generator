import React, { useState } from 'react';
import { Shield, Star, ArrowLeft, Eye, EyeOff, Lock, Mail, AlertCircle, Check } from 'lucide-react';

interface LoginPageProps {
  onAuth: (email: string, password?: string, isSignUp?: boolean) => Promise<void>;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuth, onBack }) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setIsLoading(false);
        return;
    }

    try {
        await onAuth(email, password, isSignUp);
        // Success handling is done by parent via View switch
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Authentication failed. Please try again.");
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white animate-fade-in-up">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:w-1/2 xl:w-[40%] border-r border-slate-100 relative">
        <button 
          onClick={onBack}
          className="absolute top-8 left-8 text-slate-400 hover:text-slate-600 flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} /> Back to Home
        </button>

        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isSignUp ? 'Start generating professional quotes today.' : 'Access your history and settings.'}
            </p>
          </div>

          {/* Social Login */}
          <div className="space-y-3">
            <button type="button" className="w-full flex items-center justify-center gap-3 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium py-2.5 px-4 rounded-xl transition-all relative group">
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-400 uppercase tracking-wider font-medium text-xs">Or continue with email</span>
            </div>
          </div>

          {/* Main Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={18} className="text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                    {!isSignUp && (
                        <a href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-500">Forgot password?</a>
                    )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={18} className="text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button onClick={() => setIsSignUp(!isSignUp)} className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors">
                {isSignUp ? 'Sign in' : 'Sign up for free'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Marketing / Visuals */}
      <div className="hidden lg:flex flex-1 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 lg:p-16">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
             <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
               <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
             </svg>
        </div>
        
        <div className="relative z-10">
            <h3 className="text-3xl font-bold text-white mb-6">Professional estimates in seconds, not hours.</h3>
            <ul className="space-y-4 text-slate-300">
                {[
                    "Unlimited PDF Downloads",
                    "Cloud History Sync",
                    "Custom Logo & Branding",
                    "Client Email Integration"
                ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                        <div className="bg-indigo-500/20 p-1 rounded-full">
                            <Check size={16} className="text-indigo-400" />
                        </div>
                        {item}
                    </li>
                ))}
            </ul>
        </div>

        <div className="relative z-10 mt-12">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-6 rounded-2xl">
                <div className="flex items-center gap-1 mb-3 text-yellow-400">
                    {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="currentColor" />)}
                </div>
                <p className="text-slate-300 italic mb-4 text-lg">
                    "I used to spend my Sunday nights typing up quotes in Word. Now I do it in the truck between jobs. This thing pays for itself in one day."
                </p>
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">MR</div>
                    <div>
                        <div className="text-white font-bold">Mike Reynolds</div>
                        <div className="text-slate-400 text-xs">Owner, Reynolds Roofing</div>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2 mt-8 text-slate-500 text-xs">
                <Shield size={12} />
                <span>256-bit SSL Encrypted • GDPR Compliant</span>
            </div>
        </div>

      </div>
    </div>
  );
};
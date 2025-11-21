import React, { useState } from 'react';
import { Shield, ArrowLeft, Eye, EyeOff, Lock, Mail, AlertCircle, Check, Zap, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onAuth: (email: string, password?: string, isSignUp?: boolean) => Promise<void | { requiresConfirmation?: boolean }>;
  onResetPassword: (email: string) => Promise<void>;
  onBack: () => void;
  onUpgrade: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuth, onResetPassword, onBack, onUpgrade }) => {
  // Modes: 'signin', 'forgot'
  const [authMode, setAuthMode] = useState<'signin' | 'forgot'>('signin'); 
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Handle Forgot Password
    if (authMode === 'forgot') {
        try {
            await onResetPassword(email);
            setResetSent(true);
            setIsLoading(false);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to send reset link. Please try again.");
            setIsLoading(false);
        }
        return;
    }

    // Handle Sign In
    if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setIsLoading(false);
        return;
    }

    try {
        // Always false for isSignUp, because signup happens after payment
        await onAuth(email, password, false);
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Authentication failed. Please check your credentials.");
        setIsLoading(false);
    }
  };

  if (needsConfirmation) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 animate-fade-in-up">
             <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                 <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
                     <Mail size={32} />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h2>
                 <p className="text-slate-500 mb-8">
                     We've sent a confirmation link to <strong>{email}</strong>.
                 </p>
                 <button
                    onClick={() => {
                        setNeedsConfirmation(false);
                        setAuthMode('signin');
                        setError(null);
                    }}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
                 >
                     Return to Sign In
                 </button>
             </div>
        </div>
      );
  }

  if (resetSent) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 animate-fade-in-up">
             <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                 <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                     <Check size={32} />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset Link Sent</h2>
                 <p className="text-slate-500 mb-8">
                     We've sent a password reset link to <strong>{email}</strong>.
                 </p>
                 <button
                    onClick={() => {
                        setResetSent(false);
                        setAuthMode('signin');
                        setError(null);
                    }}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
                 >
                     Return to Sign In
                 </button>
             </div>
        </div>
      );
  }

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
          
          {/* Pro Upsell Card for New Users */}
          {authMode === 'signin' && (
            <div className="mb-8 bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200 overflow-hidden relative group cursor-pointer" onClick={onUpgrade}>
               <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap size={80} />
               </div>
               <h3 className="font-bold text-lg mb-1">New here?</h3>
               <p className="text-slate-300 text-sm mb-4">
                 Purchase unlimited access to create your account.
               </p>
               <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
               >
                 Get Unlimited Access <ArrowRight size={16} />
               </button>
            </div>
          )}

          <div className="text-center mb-8 relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-white text-sm text-slate-500 font-medium">
                 {authMode === 'signin' ? 'Or log in to existing account' : 'Reset Password'}
              </span>
            </div>
          </div>

          <form className="space-y-6 animate-fade-in-up" onSubmit={handleSubmit}>
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

            {authMode !== 'forgot' && (
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                        {authMode === 'signin' && (
                            <button 
                                type="button"
                                onClick={() => { setAuthMode('forgot'); setError(null); }}
                                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                            >
                                Forgot password?
                            </button>
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
            )}
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
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-white text-slate-900 border-slate-300 hover:bg-slate-50`}
            >
                {isLoading ? 'Processing...' : (
                    authMode === 'signin' ? 'Log In' : 'Send Reset Link'
                )}
            </button>
            </div>
        </form>

          <div className="mt-6 text-center">
            {authMode === 'forgot' && (
                <button 
                    onClick={() => { setAuthMode('signin'); setError(null); }}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                    Back to Log In
                </button>
            )}
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
                    "Cloud History Sync",
                    "Custom Logo & Branding",
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

        <div className="relative z-10 mt-auto">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
                <Shield size={12} />
                <span>256-bit SSL Encrypted • GDPR Compliant</span>
            </div>
        </div>

      </div>
    </div>
  );
};
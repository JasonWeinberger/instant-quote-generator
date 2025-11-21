import React, { useState, useEffect } from 'react';
import { Check, Lock, ArrowRight, AlertCircle, Shield, Loader2 } from 'lucide-react';
import { User } from '../shared-types';

interface PaymentSuccessPageProps {
  user: User | null;
  onActivate: (email?: string, password?: string) => Promise<void>;
}

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onActivate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoActivating, setAutoActivating] = useState(false);

  // Auto-activate if user session is present
  useEffect(() => {
    if (user) {
        setAutoActivating(true);
        onActivate()
            .catch(err => {
                console.error(err);
                setError("Failed to automatically activate. Please try signing in below.");
                setAutoActivating(false);
            });
    }
  }, [user]);

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
      await onActivate(email, password);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to activate account. Please try again.");
      setIsLoading(false);
    }
  };

  if (autoActivating) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-sm w-full">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                <h2 className="text-xl font-bold text-slate-900">Finalizing Account...</h2>
                <p className="text-slate-500 mt-2">Confirming your payment and unlocking unlimited access.</p>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 animate-fade-in-up">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-green-600 p-8 text-center relative overflow-hidden">
             <div className="absolute inset-0 opacity-10">
                  <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                  </svg>
             </div>
             <div className="relative z-10">
                 <div className="w-16 h-16 bg-white text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Check size={32} strokeWidth={3} />
                 </div>
                 <h2 className="text-2xl font-bold text-white">Order Confirmed!</h2>
                 <p className="text-green-100 mt-2 text-sm font-medium">
                    Your payment was received successfully.
                 </p>
             </div>
        </div>

        <div className="p-8">
          <div className="mb-6 text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Create Account to Activate</h3>
              <p className="text-slate-500 text-sm">
                  Create your login (or sign in) to verify your account and <span className="text-indigo-600 font-bold">instantly unlock unlimited quotes</span>.
              </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Choose Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-4 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-200 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-70 transform hover:-translate-y-0.5"
            >
              {isLoading ? 'Activating...' : 'Create Account & Unlock'} <ArrowRight size={16} />
            </button>
            
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-4">
                <Shield size={12} />
                <span>Secure Verification</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
// components/LoginPage.tsx
import React, { useState } from 'react';
import { ArrowLeft, LogIn, AlertCircle, Lock, Mail } from 'lucide-react';

interface LoginPageProps {
  onAuth: (email: string, password: string) => Promise<void> | void;
  onResetPassword: (email: string) => Promise<void>;
  onBack: () => void;
  onUpgrade: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onAuth,
  onResetPassword,
  onBack,
  onUpgrade,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setLoadingLogin(true);

    try {
      await onAuth(email, password);
      // If onAuth throws, we’ll go to catch and not get here
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your email and password.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email first, then click "Forgot password".');
      return;
    }

    setError(null);
    setResetMessage(null);
    setLoadingReset(true);

    try {
      await onResetPassword(email);
      setResetMessage('Password reset link sent. Please check your email.');
    } catch (err: any) {
      setError(err?.message || 'Could not send reset email.');
    } finally {
      setLoadingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-xs text-slate-500 mb-4 hover:text-slate-700"
        >
          <ArrowLeft size={14} className="mr-1" /> Back
        </button>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Log in</h1>
        <p className="text-sm text-slate-500 mb-6">
          Use the same email and password you set when you upgraded.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Your password"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {resetMessage && (
            <p className="text-xs text-green-600 bg-green-50 border border-green-100 px-3 py-2 rounded-lg">
              {resetMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loadingLogin}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {loadingLogin ? (
              <>Logging in…</>
            ) : (
              <>
                <LogIn size={18} /> Log in
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={loadingReset}
          className="mt-4 text-xs text-indigo-600 hover:text-indigo-700"
        >
          {loadingReset ? 'Sending reset link…' : 'Forgot password?'}
        </button>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 mb-2">Don’t have an account yet?</p>
          <button
            type="button"
            onClick={onUpgrade}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            Get unlimited access
          </button>
        </div>
      </div>
    </div>
  );
};

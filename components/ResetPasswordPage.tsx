// components/ResetPasswordPage.tsx
import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Loader2, AlertCircle, Lock } from 'lucide-react';

interface ResetPasswordPageProps {
  onSuccess: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Make sure we have a valid auth session when this page loads
  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setError('Password reset is not configured correctly. Please contact support.');
        setInitializing(false);
        return;
      }

      const client = supabase!;

      try {
        let { data: sessionData } = await client.auth.getSession();

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        // Supabase might use ?type=recovery, ?auth=recovery, or hash
        const flowType =
          url.searchParams.get('type') ||
          url.searchParams.get('auth') ||
          (url.hash.includes('type=recovery') ? 'recovery' : undefined);

        // If we don't already have a session and we have a code, exchange it
        if (!sessionData?.session && code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[reset] exchangeCodeForSession error', exchangeError);
            throw exchangeError;
          }

          // Clean auth params from URL after successful exchange
          url.searchParams.delete('code');
          url.searchParams.delete('type');
          url.searchParams.delete('auth');
          window.history.replaceState({}, document.title, url.toString());

          // Re-fetch session
          sessionData = (await client.auth.getSession()).data;
        }

        if (!sessionData?.session || flowType !== 'recovery') {
          setError('This reset link is invalid or has expired. Please request a new one.');
          setInitializing(false);
          return;
        }

        setInitializing(false);
      } catch (err) {
        console.error('[reset] init error', err);
        setError('This reset link is invalid or has expired. Please request a new one.');
        setInitializing(false);
      }
    };

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured() || !supabase) {
      setError('Password reset is not configured correctly. Please contact support.');
      return;
    }

    setLoading(true);

    try {
      const client = supabase!;
      const { error: updateError } = await client.auth.updateUser({ password });

      if (updateError) {
        console.error('[reset] updateUser error', updateError);

        if (updateError.message.toLowerCase().includes('auth session missing')) {
          setError('Your reset link has expired. Please request a new password reset email.');
        } else {
          setError(updateError.message || 'Could not update password. Please try again.');
        }

        setLoading(false);
        return;
      }

      // Password updated successfully
      onSuccess();
    } catch (err: any) {
      console.error('[reset] unexpected error', err);
      setError('Could not update password. Please try again.');
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 flex flex-col items-center">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-4" />
          <p className="text-sm text-slate-600">Verifying your reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
          Set New Password
        </h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          Please enter a new password for your account.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg mb-4">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Enter a new password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Updating…
              </>
            ) : (
              <>Update Password</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

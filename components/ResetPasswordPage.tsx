// components/ResetPasswordPage.tsx
import React, { useEffect, useState } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ResetPasswordPageProps {
  onSuccess: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure we actually have a valid auth session when this page loads
  useEffect(() => {
    let cancelled = false;

    const prepareSession = async () => {
      if (!supabase) return;

      setError(null);

      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const typeOrAuth =
        url.searchParams.get('type') ||
        url.searchParams.get('auth') ||
        (url.hash.includes('type=recovery') ? 'recovery' : undefined);

      try {
        // 1) If a session already exists, we’re good.
        const { data: existing } = await supabase.auth.getSession();
        if (existing?.session) {
          if (!cancelled) setSessionReady(true);
          return;
        }

        // 2) No session but we have a recovery code => exchange it.
        if (code && typeOrAuth === 'recovery') {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error('exchangeCodeForSession error', exchangeError);
            if (!cancelled) {
              setError('This reset link is invalid or has expired. Please request a new one.');
            }
            return;
          }

          // Clean the URL so the code isn’t reused / leaked
          url.searchParams.delete('code');
          url.searchParams.delete('type');
          url.searchParams.delete('auth');
          window.history.replaceState({}, document.title, url.toString());

          const { data: afterExchange } = await supabase.auth.getSession();
          if (!afterExchange?.session) {
            if (!cancelled) {
              setError('This reset link is invalid or has expired. Please request a new one.');
            }
            return;
          }

          if (!cancelled) setSessionReady(true);
        } else {
          // No code + no session => nothing we can do
          if (!cancelled) {
            setError('This reset link is invalid or has expired. Please request a new one.');
          }
        }
      } catch (err) {
        console.error('prepareSession unexpected error', err);
        if (!cancelled) {
          setError('This reset link is invalid or has expired. Please request a new one.');
        }
      }
    };

    prepareSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        console.error('updateUser error', updateError);
        setError(updateError.message || 'Could not update password. Please try again.');
        return;
      }

      // Password updated successfully
      onSuccess();
    } catch (err) {
      console.error('updateUser unexpected error', err);
      setError('Could not update password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = !sessionReady || submitting;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
          <Lock className="text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
          Set New Password
        </h1>
        <p className="text-sm text-center text-slate-500 mb-6">
          Please enter a new password for your account.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              New password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Enter a new password"
              disabled={!sessionReady || submitting}
            />
          </div>

          <button
            type="submit"
            disabled={disabled}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-lg transition-all"
          >
            {submitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

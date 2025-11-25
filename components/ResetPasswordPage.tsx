// components/ResetPasswordPage.tsx
import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ResetPasswordPageProps {
  onSuccess: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // On mount, make sure we *actually* have a session from the recovery link
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        console.error('No session found for password reset', error);
        setError('Reset session missing. Please open the reset link from your email again.');
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setSubmitting(true);
    setError(null);

    try {
      // Extra guard: confirm there is a user on the session
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('getUser error / no user', userError);
        setError('Reset session not found. Please re-open the reset link from your email.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        console.error('updateUser error', updateError);
        setError(updateError.message || 'Could not update password. Please try again.');
        return;
      }

      setDone(true);

      // Small delay so the success message is visible, then hand back to App
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      console.error('Unexpected reset error', err);
      setError(err?.message || 'Unexpected error updating password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
            <Lock className="text-indigo-600" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Set New Password</h1>
          <p className="text-sm text-slate-500 text-center">
            Please enter a new password for your account.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
            <AlertCircle size={16} className="mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {done && !error && (
          <div className="mb-4 flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">
            <CheckCircle2 size={16} className="mt-0.5" />
            <span>Password updated. Redirecting…</span>
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Enter a new password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full py-3.5 bg-indigo-600 disabled:bg-slate-400 disabled:cursor-not-allowed hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center"
          >
            {submitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Lock, AlertCircle, Check } from 'lucide-react';

// Create Supabase client (same env vars as elsewhere)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface ResetPasswordPageProps {
  onSuccess: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Please enter a new password.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Must have a valid recovery session (magic link)
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        console.error('[ResetPassword] updateUser error:', updateError);
        setError(updateError.message || 'Unable to update password.');
        return;
      }

      // Success
      setDone(true);

      // Tiny delay just so user sees success state, then let App.tsx redirect
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err: any) {
      console.error('[ResetPassword] unexpected error:', err);
      setError(err.message || 'Unexpected error while updating password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
          {done ? (
            <Check size={32} className="text-green-600" />
          ) : (
            <Lock size={32} className="text-indigo-600" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {done ? 'Password Updated' : 'Set New Password'}
        </h1>

        <p className="text-slate-500 mb-6 text-sm">
          {done
            ? 'Your password has been updated. Redirecting you to the app...'
            : 'Please enter a new password for your account.'}
        </p>

        {!done && (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="Enter a new password"
              required
            />

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;

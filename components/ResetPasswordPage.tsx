// components/ResetPasswordPage.tsx
import React, { useState } from 'react';

export interface ResetPasswordPageProps {
  onSuccess: () => void;
  onUpdatePassword: (password: string) => Promise<void>;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onSuccess,
  onUpdatePassword,
}) => {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);

    try {
      await onUpdatePassword(password);
      onSuccess();
    } catch (err: any) {
      // Show Supabase error (invalid/expired link, missing session, etc.)
      setError(err?.message || 'Something went wrong. Please request a new link.');
    } finally {
      // 🔥 ensures the field & button are re-enabled after ANY outcome
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8"
      >
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
          {/* Optional: add a lock icon here */}
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Set New Password</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          Please enter a new password for your account.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex gap-2">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-slate-700 mb-2">
          New password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          disabled={submitting} // ⬅ only disabled while we’re actually updating
          className="w-full border border-slate-200 rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg text-white font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};


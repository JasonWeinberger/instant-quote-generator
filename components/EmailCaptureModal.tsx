// src/components/EmailCaptureModal.tsx
import React, { useEffect, useState } from 'react';
import { X, Mail, Lock } from 'lucide-react';

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, password: string) => void;
  initialEmail?: string;
}

export const EmailCaptureModal: React.FC<EmailCaptureModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail || '');
      setPassword('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }

    if (!password.trim()) {
      setError('Please create a password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(email.trim(), password);
    } catch (err: any) {
      console.error('[EmailCaptureModal] submit error', err);
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 shadow-sm transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
            Get Unlimited Access
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Enter your email and create a password to continue to secure payment.
          </p>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Create a password <span className="text-slate-400">(min. 6 characters)</span>
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"
            >
              {isSubmitting ? 'Continuing…' : 'Continue to Payment'}
            </button>

            <p className="text-[11px] text-slate-400 text-center mt-2">
              Your password will also be used to log into your account after purchase.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

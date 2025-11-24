import React, { useEffect, useState, useRef } from 'react';
import { Check, Loader2, AlertCircle, ArrowRight, LogIn, Mail } from 'lucide-react';
import { User } from '../shared-types';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface PaymentSuccessPageProps {
  user: User | null;
  /**
   * onActivate is now optional and not used.
   * Kept only so parent components don't break.
   */
  onActivate?: (
    email: string,
    password: string
  ) => Promise<{
    result: 'success' | 'existing_user' | 'email_confirmation_required' | 'error',
    message?: string
  }>;
}

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user }) => {
  const [status, setStatus] = useState<
    'loading' | 'error' | 'success' | 'existing_user' | 'email_confirmation_required'
  >('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<string>('');

  const activationAttempted = useRef(false);

  useEffect(() => {
    if (activationAttempted.current) return;
    activationAttempted.current = true;

    // Retrieve stored email + password from BEFORE Stripe checkout
    const email = localStorage.getItem('pendingUpgradeEmail') || user?.email || '';
    const password = localStorage.getItem('pendingUpgradePassword') || '';

    if (!email || !password) {
      console.log('[PaymentSuccessPage] Missing email or password');
      setStatus('error');
      setErrorMessage('Could not verify your account. Please contact support.');
      return;
    }

    setTargetEmail(email);

    const executeSignUp = async () => {
      try {
        console.log('[PaymentSuccessPage] calling supabase.auth.signUp to send activation email');

        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });

        // Clean up stored values regardless of outcome
        localStorage.removeItem('pendingUpgradeEmail');
        localStorage.removeItem('pendingUpgradePassword');

        if (error) {
          console.error('[PaymentSuccessPage] signUp error:', error);

          // If the user already exists, just tell them to log in
          const msg = error.message.toLowerCase();
          if (msg.includes('user already registered') || msg.includes('already registered')) {
            setStatus('existing_user');
            return;
          }

          setStatus('error');
          setErrorMessage(error.message || 'Activation failed.');
          return;
        }

        // If signUp succeeds, Supabase has sent the confirmation email
        console.log('[PaymentSuccessPage] signUp success:', data);
        setStatus('email_confirmation_required');
      } catch (err: any) {
        console.error('[PaymentSuccessPage] Error in activation process', err);
        setStatus('error');
        setErrorMessage(err.message || 'Unexpected error occurred.');
      }
    };

    executeSignUp();
  }, [user?.email]);

  // --- UI States ---

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-fade-in-up">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Activation Issue</h2>
          <p className="text-slate-500 mb-6">
            {errorMessage || 'Please wait, redirecting...'}
          </p>
          <a
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
          >
            Return Home
          </a>
        </div>
      </div>
    );
  }

  if (status === 'email_confirmation_required') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-fade-in-up">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600">
            <Mail size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h2>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            Your account has been created!<br />
            We sent a confirmation link to <strong>{targetEmail}</strong>.
            <br />
            <br />
            Please check your inbox (and spam folder) to verify your email and
            access your Pro account.
          </p>
          <a
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
          >
            Return to Home <ArrowRight size={16} />
          </a>
        </div>
      </div>
    );
  }

  if (status === 'existing_user') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-fade-in-up">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
            <LogIn size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Account Exists</h2>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            Payment received! <br />
            We found an existing account for <strong>{targetEmail}</strong>.
            <br />
            <br />
            Please log in to access your Pro features.
          </p>
          <a
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all"
          >
            Log In <ArrowRight size={16} />
          </a>
        </div>
      </div>
    );
  }

  // SUCCESS or LOADING (success isn't really used now, but kept for compatibility)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white p-10 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-sm w-full border border-slate-200">
        {status === 'success' ? (
          <div className="relative mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg animate-fade-in-up">
              <Check size={32} strokeWidth={3} />
            </div>
          </div>
        ) : (
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-white p-2 rounded-full shadow-sm z-10">
              <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-inner">
                <Loader2 size={32} className="animate-spin" />
              </div>
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {status === 'success' ? 'Payment Successful!' : 'Finalizing account...'}
        </h2>

        {status === 'success' ? (
          <p className="text-slate-500 text-sm mb-4">
            Redirecting you to the dashboard...
          </p>
        ) : (
          <p className="text-slate-400 text-sm mt-2">
            Please wait while we send your activation link.
          </p>
        )}
      </div>
    </div>
  );
};

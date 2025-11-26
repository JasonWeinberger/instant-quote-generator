import React, { useEffect, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { User } from '../shared-types';
import { supabase } from '../lib/supabase';

interface PaymentSuccessPageProps {
  user: User | null;
  onActivate: (userId: string, email: string) => Promise<void>;
}

// Status states for the activation/ email flow
type Status = 'sending' | 'sent' | 'error' | 'missing';

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = () => {
  const [status, setStatus] = useState<Status>('sending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (!supabase) {
          setStatus('error');
          setErrorMessage('Supabase client not initialized.');
          return;
        }

        const email = localStorage.getItem('temp_email');
        const password = localStorage.getItem('temp_password');

        // If we somehow lost the temp credentials
        if (!email || !password) {
          setStatus('missing');
          setErrorMessage(
            "We couldn't find your login details. If you don't receive an activation email in a few minutes, please contact support."
          );
          return;
        }

        // 1) Try to sign them up AFTER payment, with Pro/Unlimited metadata
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              plan: 'pro',
              status: 'active',
              tier: 'unlimited'
            }
          }
        });

        // 2) If user already exists, send them a magic login link instead
        if (signUpError) {
          const msg = signUpError.message.toLowerCase();
          if (msg.includes('already registered')) {
            const { error: otpError } = await supabase.auth.signInWithOtp({
              email,
              options: {
                emailRedirectTo: `${window.location.origin}/`
              }
            });

            if (otpError) {
              setStatus('error');
              setErrorMessage(otpError.message);
              return;
            }
          } else {
            setStatus('error');
            setErrorMessage(signUpError.message);
            return;
          }
        }

        // 3) Clean up temp credentials – not needed anymore
        localStorage.removeItem('temp_email');
        localStorage.removeItem('temp_password');

        // 4) Show success message
        setStatus('sent');
        setErrorMessage(
          'We’ve emailed you a secure activation link. Click it to be automatically logged into your Pro account with unlimited quotes.'
        );
      } catch (err: any) {
        console.error('Payment success / activation email error:', err);
        setStatus('error');
        setErrorMessage(
          err.message || 'Something went wrong while sending your activation link.'
        );
      }
    };

    run();
  }, []);

  // --- UI STATES ---

  if (status === 'sending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Received</h2>
          <p className="text-slate-600 mb-2">Thank you for your purchase!</p>
          <p className="text-slate-500 text-sm">
            We’re preparing your activation email. This usually takes just a few seconds...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Check size={28} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Received</h2>
          <p className="text-slate-600 mb-2">Thank you for your purchase!</p>
          <p className="text-slate-500 text-sm">
            {errorMessage}
          </p>
          <p className="text-slate-400 text-xs mt-4">
            Didn’t get the email after a few minutes? Check your spam/junk folder or contact support.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Received</h2>
          <p className="text-slate-600 mb-2">
            Your payment went through, but we couldn’t find your login details.
          </p>
          <p className="text-slate-500 text-sm">
            {errorMessage}
          </p>
        </div>
      </div>
    );
  }

  // status === 'error'
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-red-600">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Received</h2>
        <p className="text-slate-600 mb-2">
          Your payment succeeded, but we hit a snag sending your activation link.
        </p>
        <p className="text-red-600 text-sm mb-2">
          {errorMessage}
        </p>
        <p className="text-slate-500 text-sm">
          Please try again in a minute, or contact support if this keeps happening.
        </p>
      </div>
    </div>
  );
};

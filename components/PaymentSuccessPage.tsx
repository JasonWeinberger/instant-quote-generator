import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Check, Loader2, AlertCircle, ArrowRight, LogIn, Mail, RefreshCcw } from 'lucide-react';
import { User } from '../shared-types';

interface PaymentSuccessPageProps {
  user: User | null;
  onActivate: (email: string) => Promise<{ result: 'success' | 'existing_user' | 'email_confirmation_required' | 'rate_limited' | 'error', message?: string }>;
}

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onActivate }) => {
  const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'existing_user' | 'email_confirmation_required' | 'rate_limited'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<string>('');
  
  const activationAttempted = useRef(false);

  const runActivation = useCallback(async (emailToActivate: string) => {
      setStatus('loading');
      setErrorMessage(null);

      try {
          const response = await onActivate(emailToActivate);
          console.log('[PaymentSuccessPage] onActivate response', response);

          switch (response.result) {
              case 'success':
                  setStatus('success');
                  setTimeout(() => {
                      window.location.href = '/';
                  }, 1000);
                  break;
              case 'existing_user':
                  setStatus('existing_user');
                  break;
              case 'email_confirmation_required':
                  setStatus('email_confirmation_required');
                  break;
              case 'rate_limited':
                  setStatus('rate_limited');
                  setErrorMessage(response.message || 'We just emailed you a confirmation link. Please wait about a minute before trying again.');
                  break;
              default:
                  setStatus('error');
                  setErrorMessage(response.message || 'Activation failed.');
                  break;
          }
      } catch (err: any) {
           console.error('[PaymentSuccessPage] Error calling onActivate', err);
           setStatus('error');
           setErrorMessage(err.message || 'Unexpected error occurred.');
      }
  }, [onActivate]);

  useEffect(() => {
    if (activationAttempted.current) return;
    
      let storedEmail: string | null = null;
      try {
          storedEmail = localStorage.getItem('pendingUpgradeEmail');
      } catch (storageErr) {
          console.warn('[PaymentSuccessPage] Unable to access localStorage', storageErr);
      }

      const pendingEmail = storedEmail || user?.email;
      if (!pendingEmail) {
          console.log('[PaymentSuccessPage] No email found in storage or user object');
          setStatus('error');
          setErrorMessage('Could not find account details. Please contact support.');
          return;
      }

    setTargetEmail(pendingEmail);
    activationAttempted.current = true;

      console.log('[PaymentSuccessPage] calling onActivate with', pendingEmail);
      runActivation(pendingEmail);

    }, [runActivation, user?.email]); 

    const handleRetry = () => {
        if (!targetEmail) return;
        console.log('[PaymentSuccessPage] manual retry requested');
        runActivation(targetEmail);
    };

  // --- UI STATES ---

  if (status === 'error') {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-fade-in-up">
             <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
                 <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                     <AlertCircle size={32} />
                 </div>
                 <h2 className="text-xl font-bold text-slate-900 mb-2">Activation Issue</h2>
                 <p className="text-slate-500 mb-6">{errorMessage || "Please wait, redirecting..."}</p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleRetry}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
                    >
                        <RefreshCcw size={18} /> Retry Activation
                    </button>
                    <a href="/" className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                        Return Home
                    </a>
                </div>
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
                    Your account has been created!<br/>
                    We sent a confirmation link to <strong>{targetEmail}</strong>.
                    <br/><br/>
                    Please check your inbox (and spam folder) to verify your email and access your Pro account.
                 </p>
                 <a href="/" className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                     Return to Home <ArrowRight size={16} />
                 </a>
             </div>
        </div>
      );
  }

    if (status === 'rate_limited') {
        return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-fade-in-up">
               <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-amber-200">
                   <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                       <AlertCircle size={32} />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-900 mb-2">We Need a Minute</h2>
                   <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                      Stripe let us know you paid, but Supabase asked us to slow down on sending confirmation links.<br/><br/>
                      Check your inbox for <strong>{targetEmail}</strong> or retry in about a minute.
                      {errorMessage && (
                        <>
                          <br/><br/>{errorMessage}
                        </>
                      )}
                   </p>
                   <div className="flex flex-col gap-3">
                       <button
                           onClick={handleRetry}
                           className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
                       >
                           <RefreshCcw size={18} /> Try Again
                       </button>
                       <a href="/" className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                           Return Home
                       </a>
                   </div>
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
                    Payment received! <br/>
                    We found an existing account for <strong>{targetEmail}</strong>.
                    <br/><br/>
                    Please log in to access your Pro features.
                 </p>
                 <a href="/" className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                     Log In <ArrowRight size={16} />
                 </a>
             </div>
        </div>
      );
  }

  // SUCCESS or LOADING state
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
                Please wait while we unlock your unlimited access.
            </p>
        )}
      </div>
    </div>
  );
};
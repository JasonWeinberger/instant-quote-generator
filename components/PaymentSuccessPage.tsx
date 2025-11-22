import React, { useEffect, useState, useRef } from 'react';
import { Check, Loader2, AlertCircle, ArrowRight, LogIn } from 'lucide-react';
import { User } from '../shared-types';

interface PaymentSuccessPageProps {
  user: User | null;
  onActivate: (email: string) => Promise<{ result: 'success' | 'existing_user' }>;
}

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onActivate }) => {
  const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'existing_user'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<string>('');
  const [showManualButton, setShowManualButton] = useState(false);
  
  const activationAttempted = useRef(false);

  // 1. NUCLEAR OPTION: Unconditional Redirect Timer
  // If for ANY reason (network error, logic bug, cosmic rays) the user is still here 
  // after 5 seconds, we force them to the dashboard.
  useEffect(() => {
    const forceRedirectTimer = setTimeout(() => {
      console.warn("Force redirect timeout triggered - sending to dashboard");
      window.location.href = '/';
    }, 5000);

    const manualButtonTimer = setTimeout(() => setShowManualButton(true), 2500);

    return () => {
      clearTimeout(forceRedirectTimer);
      clearTimeout(manualButtonTimer);
    };
  }, []);

  useEffect(() => {
    // 2. Guard: Do not run activation if user is already active and logged in.
    if (user?.status === 'active') {
        setStatus('success');
        setTimeout(() => window.location.href = '/', 1000);
        return;
    }

    const activateAccount = async () => {
        if (activationAttempted.current) return;
        activationAttempted.current = true;

        const pendingEmail = localStorage.getItem('pendingUpgradeEmail');
        const emailToUse = pendingEmail || user?.email;

        if (!emailToUse) {
            // If we can't find an email, we can't activate. 
            // But the Force Redirect Timer above will still save the user eventually.
            setStatus('error');
            setErrorMessage("Could not find account details. Redirecting...");
            return;
        }
        setTargetEmail(emailToUse);

        try {
            const response = await onActivate(emailToUse);
            
            if (response.result === 'existing_user') {
                setStatus('existing_user');
            } else {
                setStatus('success');
                // Fast redirect on success
                setTimeout(() => window.location.href = '/', 1000);
            }
        } catch (err: any) {
            console.error("Activation error:", err);
            // Even on error, show success and let the user in. 
            // The backend state might be lagging but we shouldn't block access.
            setStatus('success');
            setTimeout(() => window.location.href = '/', 1000);
        }
    };

    activateAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleManualContinue = () => {
      window.location.href = '/';
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
                 <button onClick={handleManualContinue} className="block w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                     Return Home
                 </button>
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
                 <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg">
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
        
        {/* Fail-safe manual button if auto-redirect hangs or is blocked */}
        {showManualButton && (
            <button 
                onClick={handleManualContinue}
                className="mt-6 text-sm font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors animate-fade-in-up"
            >
                Taking too long? Click here to continue
            </button>
        )}
      </div>
    </div>
  );
};
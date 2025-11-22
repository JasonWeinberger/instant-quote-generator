import React, { useEffect, useState, useRef } from 'react';
import { Check, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { User } from '../shared-types';

interface PaymentSuccessPageProps {
  user: User | null;
  onActivate: (email: string) => Promise<void>;
}

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onActivate }) => {
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Ref to track if activation has already been attempted.
  // This prevents double-execution in React Strict Mode and race conditions.
  const activationAttempted = useRef(false);

  useEffect(() => {
    // 1. Guard: Do not run activation if user is already active.
    // This prevents re-running logic if the component re-renders with the updated user object.
    if (user?.status === 'active') {
        return;
    }

    const activateAccount = async () => {
        // Prevent multiple calls
        if (activationAttempted.current) return;
        activationAttempted.current = true;

        // 1. Get email from local storage (set before Stripe redirect)
        const pendingEmail = localStorage.getItem('pendingUpgradeEmail');
        
        // 2. Fallback: If user is already logged in (e.g. upgrading from free), use that email.
        // NOTE: Since the dependency array is empty [], 'user' here refers to the value AT MOUNT.
        // This is intentional to prevent the effect from re-running when 'user' updates.
        const targetEmail = pendingEmail || user?.email;

        if (!targetEmail) {
            setStatus('error');
            setErrorMessage("Could not find account details. Please contact support.");
            return;
        }

        try {
            await onActivate(targetEmail);
            setStatus('success');
            // onActivate in App.tsx typically handles the redirect, 
            // but we set success state here just in case of delay.
        } catch (err: any) {
            console.error("Activation error:", err);
            setStatus('error');
            setErrorMessage(err.message || "Activation failed.");
        }
    };

    activateAccount();
    
    // 2. EXPLICIT REQUIREMENT: Empty dependency array.
    // This ensures the logic runs exactly ONCE on mount, regardless of prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  if (status === 'error') {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-fade-in-up">
             <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
                 <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                     <AlertCircle size={32} />
                 </div>
                 <h2 className="text-xl font-bold text-slate-900 mb-2">Activation Issue</h2>
                 <p className="text-slate-500 mb-6">{errorMessage}</p>
                 <a href="/" className="block w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                     Return Home
                 </a>
             </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white p-10 rounded-2xl shadow-xl flex flex-col items-center text-center max-w-sm w-full border border-slate-200">
        
        {/* Animated Success/Loading State */}
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-white p-2 rounded-full shadow-sm z-10">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white shadow-inner">
                    <Check size={32} strokeWidth={3} />
                </div>
            </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful!</h2>
        
        <div className="flex items-center justify-center gap-3 text-indigo-600 font-medium bg-indigo-50 px-4 py-2 rounded-full mb-2">
            <Loader2 className="animate-spin" size={18} />
            <span>Finalizing your account...</span>
        </div>
        
        <p className="text-slate-400 text-sm mt-4">
            Please wait while we unlock your unlimited access.
        </p>
      </div>
    </div>
  );
};
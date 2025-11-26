import React, { useEffect, useState, useRef } from 'react';
import { Check, Loader2, AlertCircle, LogIn, ArrowRight } from 'lucide-react';
import { User } from '../shared-types';
import { supabase } from '../lib/supabase';

interface PaymentSuccessPageProps {
  user: User | null;
  onActivate: (userId: string, email: string) => Promise<void>;
}

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onActivate }) => {
  const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'login_required'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const activationAttempted = useRef(false);

  useEffect(() => {
    // 1. If user is already active and logged in, just redirect.
    if (user?.status === 'active') {
        setStatus('success');
        setTimeout(() => window.location.href = '/', 1000);
        return;
    }

    const processActivation = async () => {
        if (activationAttempted.current) return;
        activationAttempted.current = true;

        // 2. Retrieve temporary credentials
        const email = localStorage.getItem('temp_email');
        const password = localStorage.getItem('temp_password');

        if (!email || !password || !supabase) {
            // No creds found? User might have closed tab or cleared cache.
            // Or they are already logged in but status didn't update.
            if (user) {
                 // If we have a user session but no temp password, just try to activate based on current session
                 try {
                    await onActivate(user.id, user.email);
                    setStatus('success');
                    setTimeout(() => window.location.href = '/', 1000);
                 } catch (e) {
                    console.error(e);
                    setStatus('error');
                    setErrorMessage("Activation failed for logged in user.");
                 }
            } else {
                 setStatus('login_required');
            }
            return;
        }

        try {
            // 3. Auto-login with credentials
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error("Auto-login failed:", error);
                // Password might be wrong or account issue. Ask them to log in manually.
                setStatus('login_required');
                return;
            }

            if (data.session && data.user) {
                // 4. Activate Pro Status
                await onActivate(data.user.id, data.user.email || email);
                
                // 5. Clear sensitive data
                localStorage.removeItem('temp_email');
                localStorage.removeItem('temp_password');
                
                setStatus('success');
                setTimeout(() => window.location.href = '/', 1000);
            } else {
                setStatus('error');
                setErrorMessage("Session could not be established.");
            }

        } catch (err: any) {
            console.error("Activation error:", err);
            setStatus('error');
            setErrorMessage(err.message || "Activation failed.");
        }
    };

    processActivation();
    
  }, [user, onActivate]); 

  // --- UI STATES ---

  if (status === 'login_required') {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 animate-fade-in-up">
             <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
                 <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                     <LogIn size={32} />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Received</h2>
                 <p className="text-slate-500 mb-6 text-sm leading-relaxed">
                    Thank you for your purchase! <br/>
                    We couldn't automatically log you in. Please sign in with the email and password you just created to access your Pro account.
                 </p>
                 <a href="/" className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
                     Log In <ArrowRight size={16} />
                 </a>
             </div>
        </div>
      );
  }

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
                Please wait while we verify your payment.
            </p>
        )}
      </div>
    </div>
  );
};
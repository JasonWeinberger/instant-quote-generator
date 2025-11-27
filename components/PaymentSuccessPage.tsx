import React, { useEffect, useState, useRef } from 'react';
import { Check, Loader2, AlertCircle, ArrowRight, LogIn, Mail } from 'lucide-react';
import { User } from '../shared-types';

interface PaymentSuccessPageProps {
  user: User | null;
  onActivate: (email: string) => Promise<{ result: 'success' | 'existing_user' | 'email_confirmation_required' | 'error', message?: string }>;
}

export const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ user, onActivate }) => {
  const [status, setStatus] = useState<'loading' | 'error' | 'success' | 'existing_user' | 'email_confirmation_required'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState<string>('');
  
  const activationAttempted = useRef(false);

  useEffect(() => {
    if (activationAttempted.current) return;
    
    const pendingEmail = localStorage.getItem('pendingUpgradeEmail') || user?.email;
    if (!pendingEmail) {
      console.log('[PaymentSuccessPage] No email found in storage or user object');
      setStatus('error');
      setErrorMessage('Could not find account details. Please contact support.');
      return;
    }

    setTargetEmail(pendingEmail);
    activationAttempted.current = true;

    const executeActivation = async () => {
        console.log('[PaymentSuccessPage] calling onActivate with', pendingEmail);
        try {
            const response = await onActivate(pendingEmail);
            console.log('[PaymentSuccessPage] onActivate response', response);

            if (response.result === 'success') {
                setStatus('success');
                // Strict success redirect
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else if (response.result === 'existing_user') {
                setStatus('existing_user');
            } else if (response.result === 'email_confirmation_required') {

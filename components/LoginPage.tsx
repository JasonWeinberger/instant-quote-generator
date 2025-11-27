import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, AlertCircle, Check, Zap, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onAuth: (email: string, password?: string) => Promise<void | { requiresConfirmation?: boolean }>;
  onResetPassword: (email: string) => Promise<void>;
  onBack: () => void;
  onUpgrade: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuth, onResetPassword, onBack, onUpgrade }) => {
  // Modes: 'signin', 'forgot'
  const [authMode, setAuthMode] = useState<'signin' | 'forgot'>('signin'); 
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Handle Forgot Password
    if (authMode === 'forgot') {
        try {
            await onResetPassword(email);
            setResetSent(true);
            setIsLoading(false);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to send reset link. Please try again.");
            setIsLoading(false);
        }
        return;
    }

    // Handle Sign In
    if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setIsLoading(false);
        return;
    }

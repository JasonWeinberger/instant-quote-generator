import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Lock } from 'lucide-react';

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
  initialEmail?: string;
}

export const EmailCaptureModal: React.FC<EmailCaptureModalProps> = ({ isOpen, onClose, onSubmit, initialEmail = '' }) => {
  const [email, setEmail] = useState(initialEmail);

  // Sync state if initialEmail prop changes (e.g. user loads asynchronously)
  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onSubmit(email);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-6 text-indigo-600">
            <Lock size={24} />
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-2">Final Step</h3>

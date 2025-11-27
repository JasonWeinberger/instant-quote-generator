import React, { useState } from 'react';
import { User } from '../shared-types';
import { STRIPE_LINKS } from '../constants';
import { CreditCard, Check, ArrowLeft, LogOut, Building, Phone, MapPin, ExternalLink, Zap, Lock as LockIcon, Mail } from 'lucide-react';

interface BillingPortalProps {
  user: User | null;
  onBack: () => void;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
  onUpdatePassword: (password: string) => Promise<void>;
}

type Tab = 'billing' | 'settings';

export const BillingPortal: React.FC<BillingPortalProps> = ({ user, onBack, onLogout, onUpdateUser, onUpdatePassword }) => {
  // Default to 'settings' if active so they see the value (Branding) immediately.
  // Default to 'billing' if inactive so they see the Upgrade prompt.
  const [activeTab, setActiveTab] = useState<Tab>(user?.status === 'active' ? 'settings' : 'billing');
  
  // Settings Form State
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [companyPhone, setCompanyPhone] = useState(user?.companyPhone || '');
  const [companyAddress, setCompanyAddress] = useState(user?.companyAddress || '');
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Status checks
  const isActive = user?.status === 'active';

  // Mock Data
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  const handleActivate = () => {
      // Open in new tab to avoid iframe blocking issues (Stripe X-Frame-Options)
      window.open(STRIPE_LINKS.monthly, '_blank');
  };

  const handleSaveSettings = (e: React.FormEvent) => {

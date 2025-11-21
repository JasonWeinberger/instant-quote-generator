import React, { useState } from 'react';
import { User } from '../shared-types';
import { STRIPE_LINKS } from '../constants';
import { CreditCard, Download, Check, AlertCircle, Calendar, Shield, ArrowLeft, LogOut, MoreHorizontal, Building, Phone, MapPin, ExternalLink, Zap, Lock } from 'lucide-react';

// Force refresh: 2

interface BillingPortalProps {
  user: User | null;
  onBack: () => void;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
  onUpdatePassword: (password: string) => Promise<void>;
}

type Tab = 'billing' | 'settings';

export const BillingPortal: React.FC<BillingPortalProps> = ({ user, onBack, onLogout, onUpdateUser, onUpdatePassword }) => {
  const [activeTab, setActiveTab] = useState<Tab>('billing');
  const [isLoading, setIsLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

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
  
  // Dynamic recent invoice date
  const lastInvoiceDate = new Date();
  lastInvoiceDate.setDate(lastInvoiceDate.getDate() - 14);

  const invoices = isActive ? [
    { id: 'INV-2024-001', date: lastInvoiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), amount: '$29.00', status: 'Paid' },
  ] : [];

  const handleManageSubscription = () => {
    setIsLoading(true);
    // In a real app with backend, redirect to Stripe Customer Portal
    // Currently just disabled or simulated as user manages via Stripe emails
    alert("Please check your email for the Stripe management link or contact support.");
    setIsLoading(false);
  };

  const handleActivate = () => {
      // Open in new tab to avoid iframe blocking issues (Stripe X-Frame-Options)
      window.open(STRIPE_LINKS.monthly, '_blank');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      
      const updatedUser: User = {
          ...user,
          companyName,
          companyPhone,
          companyAddress
      };
      
      onUpdateUser(updatedUser);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);
      
      if (newPassword.length < 6) {
          setPasswordError("Password must be at least 6 characters.");
          return;
      }
      if (newPassword !== confirmPassword) {
          setPasswordError("Passwords do not match.");
          return;
      }

      try {
          await onUpdatePassword(newPassword);
          setPasswordSaved(true);
          setNewPassword('');
          setConfirmPassword('');
          setTimeout(() => setPasswordSaved(false), 3000);
      } catch (err: any) {
          setPasswordError(err.message || "Failed to update password.");
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-fade-in-up">
      {/* Portal Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-slate-900">User Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
            <button 
              onClick={onLogout}
              className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Upgrade Banner (If not active) */}
        {!isActive && (
            <div className="mb-8 p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-6 bg-indigo-50 border-indigo-100">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-3 rounded-full shrink-0 bg-indigo-100 text-indigo-600">
                        <Zap size={24} fill="currentColor" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-indigo-900">
                            Upgrade to Unlimited
                        </h3>
                        <p className="text-indigo-700">
                            Remove the 3-quote limit and get unlimited access for just <span className="font-bold">$29/month</span>.
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-col items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={handleActivate}
                        className="w-full md:w-auto px-6 py-3 rounded-xl font-bold shadow-lg transition-all transform hover:-translate-y-0.5 whitespace-nowrap flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
                    >
                        Activate Pro Plan <ExternalLink size={16} />
                    </button>
                </div>
            </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-slate-200">
            <nav className="flex space-x-8">
                <button
                    onClick={() => setActiveTab('billing')}
                    className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'billing' 
                        ? 'border-indigo-600 text-indigo-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    Billing & Subscription
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === 'settings' 
                        ? 'border-indigo-600 text-indigo-600' 
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    Business Settings
                </button>
            </nav>
        </div>

        {activeTab === 'billing' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in-up">
            
            {/* Left Column - Main Settings */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* Current Plan Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                    <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold text-slate-900">Current Plan</h2>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            isActive 
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                            {isActive ? 'PRO' : 'FREE TIER'}
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm">
                        {isActive 
                            ? "Unlimited quotes, history storage, and priority support."
                            : "Limited to 3 quotes."
                        }
                    </p>
                    </div>
                    <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">{isActive ? '$29.00' : '$0.00'}</div>
                    <div className="text-xs text-slate-400">/ month</div>
                    </div>
                </div>
                <div className="bg-slate-50 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        {isActive ? (
                             <>
                                <Calendar size={16} className="text-slate-400" />
                                <span>Renews on <strong>{nextBillingDate.toLocaleDateString()}</strong></span>
                             </>
                        ) : (
                             <span>Upgrade to unlock unlimited access.</span>
                        )}
                    </div>
                    {isActive && (
                        <button 
                        onClick={handleManageSubscription}
                        disabled={isLoading}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
                        >
                        {isLoading ? 'Loading...' : 'Manage on Stripe'} <ExternalLink size={12} />
                        </button>
                    )}
                </div>
                </div>

                {/* Payment Method */}
                {isActive && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <CreditCard size={20} className="text-indigo-600" />
                        Payment Method
                    </h3>
                    
                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl mb-4 hover:border-indigo-300 transition-colors group cursor-pointer bg-slate-50/50">
                        <div className="flex items-center gap-4">
                        <div className="w-12 h-8 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-xs">
                            VISA
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 flex items-center gap-2">
                            •••• •••• •••• 4242
                            <span className="text-xs text-slate-400 font-normal">Expires 12/25</span>
                            </div>
                            <div className="text-xs text-slate-500">Default payment method</div>
                        </div>
                        </div>
                        <button className="text-slate-400 hover:text-indigo-600 p-2">
                        <MoreHorizontal size={20} />
                        </button>
                    </div>
                    </div>
                )}

                {/* Invoice History */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900">Billing History</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Amount</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Invoice</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                                    No invoices generated yet.
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 text-slate-900">{inv.date}</td>
                                <td className="px-6 py-4 text-slate-600">{inv.amount}</td>
                                <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                                    <Check size={10} /> {inv.status}
                                </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                <button className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-2 rounded transition-colors inline-flex items-center gap-1">
                                    <Download size={14} /> <span className="hidden sm:inline">PDF</span>
                                </button>
                                </td>
                            </tr>
                            ))
                        )}
                    </tbody>
                    </table>
                </div>
                </div>
            </div>

            {/* Right Column - Usage & Support */}
            <div className="space-y-8">
                
                {/* Usage Stats */}
                <div className="bg-slate-900 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500 rounded-full blur-2xl opacity-20"></div>
                
                <h3 className="font-bold text-lg mb-1">Plan Usage</h3>
                <p className="text-slate-400 text-sm mb-6">Your current billing period stats.</p>
                
                <div className="space-y-4">
                    <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-300">Quotes Generated</span>
                        <span className="font-bold">{isActive ? 'Unlimited' : 'Limited (3 max)'}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className={`h-2 rounded-full w-full ${isActive ? 'bg-indigo-500' : 'bg-slate-500'}`}></div>
                    </div>
                    </div>
                    <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-300">Storage Used</span>
                        <span className="font-bold">12%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full w-[12%]"></div>
                    </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                    <Shield size={12} />
                    <span>Enterprise-grade security enabled</span>
                </div>
                </div>

                {/* Support Contact */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-2">Support</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        Support or billing questions?<br/>
                        Email us at <a href="mailto:support@instantquotegenerator.com" className="text-indigo-600 font-bold hover:underline">support@instantquotegenerator.com</a><br/>
                        and we’ll respond within 24 hours.
                    </p>
                </div>

                {/* Danger Zone */}
                <div className="border border-red-100 bg-red-50 rounded-2xl p-6">
                <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                    <AlertCircle size={18} /> Cancel Subscription
                </h3>
                <p className="text-red-700 text-sm mb-4">
                    Once you cancel, you will lose access to unlimited quotes at the end of your billing period.
                </p>
                
                {!cancelConfirm ? (
                    <button 
                    onClick={() => setCancelConfirm(true)}
                    className="w-full py-2 px-4 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 hover:border-red-300 transition-all"
                    >
                    Cancel Plan
                    </button>
                ) : (
                    <div className="space-y-2">
                    <button 
                        className="w-full py-2 px-4 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all"
                    >
                        Confirm Cancellation
                    </button>
                    <button 
                        onClick={() => setCancelConfirm(false)}
                        className="w-full py-2 px-4 text-slate-500 text-sm hover:text-slate-700"
                    >
                        Keep my plan
                    </button>
                    </div>
                )}
                </div>

            </div>
            </div>
        ) : (
            /* SETTINGS TAB */
            <div className="max-w-3xl animate-fade-in-up space-y-8">
                {/* Business Profile Section */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900">Business Profile</h2>
                        <p className="text-slate-500 text-sm mt-1">
                            These details will appear on your generated quotes to make them client-ready.
                        </p>
                    </div>
                    
                    <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Company Name
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Building size={18} className="text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="e.g. Bob's Roofing LLC"
                                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Phone Number
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Phone size={18} className="text-slate-400" />
                                        </div>
                                        <input
                                            type="tel"
                                            value={companyPhone}
                                            onChange={(e) => setCompanyPhone(e.target.value)}
                                            placeholder="e.g. (555) 123-4567"
                                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Address / Region
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <MapPin size={18} className="text-slate-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={companyAddress}
                                            onChange={(e) => setCompanyAddress(e.target.value)}
                                            placeholder="e.g. Austin, TX"
                                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-between border-t border-slate-100 mt-6">
                             <p className="text-xs text-slate-400">
                                 Changes are saved locally to your device.
                             </p>
                             <button
                                type="submit"
                                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2"
                             >
                                {settingsSaved ? <Check size={18} /> : null}
                                {settingsSaved ? 'Saved!' : 'Save Changes'}
                             </button>
                        </div>
                    </form>
                </div>

                {/* Security Section (Reset Password) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900">Security</h2>
                        <p className="text-slate-500 text-sm mt-1">
                            Update your password here.
                        </p>
                    </div>
                    <form onSubmit={handlePasswordUpdate} className="p-6 space-y-6">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock size={18} className="text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        placeholder="New password"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock size={18} className="text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        placeholder="Confirm password"
                                    />
                                </div>
                            </div>
                         </div>
                         
                         {passwordError && (
                            <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                                {passwordError}
                            </div>
                         )}

                         <div className="pt-4 flex items-center justify-end border-t border-slate-100 mt-6">
                             <button
                                type="submit"
                                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
                             >
                                {passwordSaved ? <Check size={18} className="text-green-600" /> : null}
                                {passwordSaved ? 'Password Updated' : 'Update Password'}
                             </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

      </main>
    </div>
  );
}
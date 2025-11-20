import React, { useState, useEffect } from 'react';
import { QuoteResult, CostBreakdown, User } from '../shared-types';
import { Check, Copy, Download, FileText, Pencil, Calculator, Building, Phone } from 'lucide-react';

interface QuoteResultCardProps {
  result: QuoteResult;
  user: User | null;
}

export const QuoteResultCard: React.FC<QuoteResultCardProps> = ({ result, user }) => {
  const [copied, setCopied] = useState(false);
  const [breakdown, setBreakdown] = useState<CostBreakdown>(result.breakdown);

  // Sync local state if prop changes (e.g. loading history)
  useEffect(() => {
    setBreakdown(result.breakdown);
  }, [result]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result.customerQuote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBreakdownChange = (key: keyof CostBreakdown, value: string) => {
    // Allow empty string for editing, otherwise parse
    const numVal = value === '' ? 0 : parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    setBreakdown(prev => ({
      ...prev,
      [key]: numVal
    }));
  };

  // Calculated Total
  const totalCost = (Object.values(breakdown) as number[]).reduce((acc, val) => acc + val, 0);

  // Formatting currency
  const formatMoney = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  // Determine branding
  const hasBranding = user?.companyName;
  const companyName = hasBranding ? user.companyName : "Instant Quote Generator Estimate";
  const companyPhone = user?.companyPhone;

  return (
    <div className="animate-fade-in-up">
      <div className="bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden">
        {/* Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">
                {hasBranding ? <Building size={16} className="text-indigo-600" /> : <FileText size={16} className="text-indigo-600" />}
                {companyName}
            </div>
            <div className="flex gap-2">
                <button className="text-xs flex items-center gap-1 text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-md hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                    <Download size={14} /> Save PDF
                </button>
            </div>
        </div>

        <div className="p-8">
            {/* Document Header */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 pb-8 border-b border-slate-100 gap-4">
                <div>
                    <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        {formatMoney(totalCost)}
                        <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">Editable</span>
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Estimated Total Project Cost</p>
                    {companyPhone && (
                        <div className="flex items-center gap-1.5 mt-2 text-sm text-indigo-600 font-medium">
                             <Phone size={14} /> {companyPhone}
                        </div>
                    )}
                    <p className="text-xs text-slate-400 mt-2">
                      AI Market Range: {formatMoney(result.priceRange.low)} – {formatMoney(result.priceRange.high)}
                    </p>
                </div>
                <div className="text-right">
                    <div className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide inline-block mb-1">
                        {result.timeline}
                    </div>
                    <p className="text-xs text-slate-400">Estimated Timeline</p>
                </div>
            </div>

            {/* Editable Cost Grid */}
            <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Itemized Breakdown (Click to Edit)</h4>
                  <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                    <Calculator size={12} /> Auto-calculating
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {(['materials', 'labor', 'disposal', 'misc'] as const).map((key) => (
                        <div key={key} className="bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-indigo-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all relative group cursor-text">
                            <div className="flex justify-between items-start mb-1">
                              <label htmlFor={`input-${key}`} className="text-xs text-slate-500 capitalize cursor-pointer block w-full">
                                {key === 'misc' ? 'Overhead/Misc' : key}
                              </label>
                              <Pencil size={10} className="text-slate-300 opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="flex items-center text-slate-900 font-semibold">
                              <span className="text-slate-400 mr-1">$</span>
                              <input
                                id={`input-${key}`}
                                type="number"
                                value={breakdown[key]}
                                onChange={(e) => handleBreakdownChange(key, e.target.value)}
                                className="bg-transparent border-none p-0 w-full focus:ring-0 font-semibold text-slate-900"
                              />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Message Content */}
            <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-6 relative group">
                <div className="absolute top-4 right-4">
                    <button
                        onClick={handleCopy}
                        className={`
                        flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md shadow-sm transition-all
                        ${copied 
                            ? 'bg-green-500 text-white border-green-600' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}
                        `}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy Text'}
                    </button>
                </div>
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Client Message Draft</h4>
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed font-medium">
                    {result.customerQuote}
                </p>
                <div className="mt-4 pt-4 border-t border-indigo-100 text-xs text-indigo-400 italic">
                  Note: This text was generated based on the initial AI range. It does not automatically update with your manual edits above.
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
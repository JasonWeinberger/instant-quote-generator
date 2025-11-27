import React, { useState, useEffect } from 'react';
import { QuoteResult, CostBreakdown, User } from '../shared-types';
import { Check, Copy, FileText, Pencil, Calculator, Building, Phone, Download, Loader2 } from 'lucide-react';

interface QuoteResultCardProps {
  result: QuoteResult;
  user: User | null;
}

export const QuoteResultCard: React.FC<QuoteResultCardProps> = ({ result, user }) => {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
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

  const handleDownloadPDF = () => {
    setIsDownloading(true);
    
    // Small delay to ensure React state updates (spinner) are painted
    // and to unblock the main thread before heavy canvas operations.
    setTimeout(() => {
        const element = document.getElementById('quote-card-content');
        
        // Formatting filename
        const companyPrefix = user?.companyName ? user.companyName.replace(/[^a-z0-9]/gi, '_') : 'Quote';
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `${companyPrefix}_Estimate_${dateStr}.pdf`;

        const opt = {
          margin: 0.5,
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2, // Higher scale for better resolution
            useCORS: true,

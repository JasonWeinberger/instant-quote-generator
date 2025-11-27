export enum Industry {
  ROOFING = 'ROOFING',
  HVAC = 'HVAC',
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  PAINTING = 'PAINTING',
}

export interface PriceRange {
  low: number;
  high: number;
}

export interface CostBreakdown {
  materials: number;
  labor: number;
  disposal: number;
  misc: number;
}

export interface QuoteResult {
  priceRange: PriceRange;
  breakdown: CostBreakdown;
  timeline: string;
  customerQuote: string;
}

export interface HistoryItem extends QuoteResult {
  id: string;
  timestamp: number;
  industry: Industry;
  jobDescription: string;
  zipCode?: string;
}

export interface IndustryOption {
  id: Industry;
  label: string;
  disabled: boolean;
}

export interface User {
  id: string;
  email: string;
  plan: 'starter' | 'pro';
  status: 'active' | 'trial' | 'expired' | 'cancelled';
  trialStartDate: number;
  subscriptionId?: string;
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
}

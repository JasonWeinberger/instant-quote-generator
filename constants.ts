import { Industry, IndustryOption } from './shared-types';

export const INDUSTRIES: IndustryOption[] = [
  { id: Industry.ROOFING, label: 'Roofing', disabled: false },
  { id: Industry.HVAC, label: 'HVAC', disabled: false },
  { id: Industry.PLUMBING, label: 'Plumbing', disabled: false },
  { id: Industry.ELECTRICAL, label: 'Electrical', disabled: false },
  { id: Industry.PAINTING, label: 'Painting', disabled: false },
];

// ============================================================================
// 💳 STRIPE PAYMENT LINKS
// ============================================================================
// INSTRUCTIONS FOR STRIPE SETUP:
// 1. Go to Stripe Dashboard > Payments > Payment Links.
// 2. Create a new link for your product (e.g., "Pro Plan - Monthly").
// 3. Under "After payment", select "Don't show confirmation page".
// 4. Enter your redirect URL with the success flag: 
//    http://localhost:3000/?success=true  (Local Testing)
//    https://YOUR-APP-URL.vercel.app/?success=true (Production)
// 5. Copy the generated link (starts with buy.stripe.com) and paste it below.

export const STRIPE_LINKS = {
  monthly: 'https://buy.stripe.com/test_monthly_placeholder', // REPLACE THIS
  yearly: 'https://buy.stripe.com/test_yearly_placeholder',   // REPLACE THIS
};

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
//    https://YOUR-APP-URL.vercel.app/?success=true
// 5. Copy the generated link (starts with buy.stripe.com) and paste it below.

export const STRIPE_LINKS = {
  monthly: 'https://buy.stripe.com/8x28wP4zO19b8yx2cV8Vi0F', // REPLACE THIS
  yearly: 'https://buy.stripe.com/dRm14nd6k7xz0213gZ8Vi0G',   // REPLACE THIS
};

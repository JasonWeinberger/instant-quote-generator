<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1_F__-DJirkgwiuUAxN7Sln_nvt9uanNO

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. (Optional but recommended) Set `VITE_PUBLIC_SITE_URL` to the fully-qualified origin where this app is hosted (e.g. `https://instantquotegenerator.com`). This is used when generating Supabase password reset links so that emails always point to a reachable, trusted URL.
4. Run the app:
   `npm run dev`

## Password reset links (Supabase)

1. Add `https://your-domain.com/?auth=recovery` (matching `VITE_PUBLIC_SITE_URL`) to **Authentication → URL Configuration → Redirect URLs** inside Supabase.
2. When users request a password reset, new emails will point to `/` with the `?auth=recovery` query so static hosting never serves a 404.
3. Email clients tend to flag bare `http` links as suspicious; serving the app over HTTPS and configuring `VITE_PUBLIC_SITE_URL` keeps the reset email green.

## Automatic activation after Stripe payment

To create the Supabase account and log users in immediately after checkout, the app now calls a Supabase Edge Function that:

- Verifies the Checkout Session with Stripe (server-side) using your `STRIPE_SECRET_KEY`
- Creates/upgrades the Supabase auth user + `public.users` profile
- Generates a magic-link OTP and returns it to the browser so the user is signed in without clicking an email

### 1. Deploy the Edge Function

1. Install the Supabase CLI if you have not already.
2. From the project root, run `supabase functions deploy activate-paid-user --verify-jwt`  
   (the source lives in `supabase/functions/activate-paid-user/index.ts`).
3. In the Supabase dashboard, set the following Edge Function secrets:
   - `STRIPE_SECRET_KEY` – your live/test secret starting with `sk_...`
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically when deploying from Supabase; no extra work needed.

### 2. Update your Stripe success URL

When you create/edit the Stripe Payment Link, set the “After payment → Redirect to” URL to include the checkout session id placeholder:

```
https://instantquotegenerator.com/?payment_success=true&session_id={CHECKOUT_SESSION_ID}
```

The `session_id` query parameter allows the function to verify the payment before issuing the login session.

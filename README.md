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
2. Set the `GEMINI_API_KEY` (or legacy `API_KEY`) in [.env.local](.env.local) to your Gemini API key
3. (Optional but recommended) Set `VITE_PUBLIC_SITE_URL` to the fully-qualified origin where this app is hosted (e.g. `https://instantquotegenerator.com`). This is used when generating Supabase password reset links so that emails always point to a reachable, trusted URL.
4. Run the app:
   `npm run dev`

## Password reset links (Supabase)

1. Add `https://your-domain.com/?auth=recovery` (matching `VITE_PUBLIC_SITE_URL`) to **Authentication → URL Configuration → Redirect URLs** inside Supabase.
2. When users request a password reset, new emails will point to `/` with the `?auth=recovery` query so static hosting never serves a 404.
3. Email clients tend to flag bare `http` links as suspicious; serving the app over HTTPS and configuring `VITE_PUBLIC_SITE_URL` keeps the reset email green.

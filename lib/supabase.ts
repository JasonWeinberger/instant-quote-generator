// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Prefer import.meta.env in Vite; process.env *can* be polyfilled but this is safer.
// If you know process.env is working for you, you can keep it, but I'd recommend this:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Only create the client if keys are present.
// This allows the app to run in "Demo Mode" (localStorage) if Backend isn't configured yet.
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        // We will handle the URL manually in App.tsx
        detectSessionInUrl: false,
      },
    })
  : null;

// Helper to check if we are in "Real Mode"
export const isSupabaseConfigured = () => !!supabase;

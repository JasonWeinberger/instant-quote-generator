import { createClient } from '@supabase/supabase-js';

// Access environment variables directly via process.env which is polyfilled by Vite
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Only create the client if keys are present.
// This allows the app to run in "Demo Mode" (localStorage) if Backend isn't configured yet.
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Helper to check if we are in "Real Mode"
export const isSupabaseConfigured = () => !!supabase;

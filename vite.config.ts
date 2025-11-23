import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  const geminiApiKey = (env.GEMINI_API_KEY || env.API_KEY || env.VITE_GEMINI_API_KEY || env.VITE_API_KEY || '').trim();
  const supabaseUrl = (env.VITE_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'GEMINI_'],
    server: {
      port: 3000,
      host: true, // Bind to all network interfaces (0.0.0.0) to fix "localhost refused" in some envs
    },
    define: {
      // Explicitly replace process.env variables with their values during build.
      // We do NOT set 'process.env': {} here, as that can break libraries checking for process.env.NODE_ENV
      'process.env.API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      'process.env.VITE_API_KEY': JSON.stringify(geminiApiKey),
      'process.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiApiKey),
      'import.meta.env.VITE_API_KEY': JSON.stringify(geminiApiKey),
      'process.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
  };
});
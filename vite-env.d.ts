/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Augment the NodeJS namespace to type process.env correctly without replacing the global process object.
// This ensures process.env.API_KEY is typed while preserving standard methods like process.cwd().
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    [key: string]: any;
  }
}

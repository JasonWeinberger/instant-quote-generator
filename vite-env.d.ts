/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Augment the NodeJS namespace to ensure process.env is typed correctly
// without shadowing the global process variable. This fixes the "cwd missing"
// error in vite.config.ts and the "redeclare" error.
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    [key: string]: any;
  }
}

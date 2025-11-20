/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Augment NodeJS namespace to type process.env variables
// This avoids "Cannot redeclare block-scoped variable 'process'" error
// and ensures process.cwd() remains available in node configuration files.
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    [key: string]: any;
  }
}

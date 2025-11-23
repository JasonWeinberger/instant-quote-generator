interface ImportMetaEnv {
  readonly API_KEY?: string;
  readonly GEMINI_API_KEY?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
    interface ProcessEnv {
    API_KEY?: string;
    GEMINI_API_KEY?: string;
    VITE_API_KEY?: string;
    VITE_GEMINI_API_KEY?: string;
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
    VITE_PUBLIC_SITE_URL?: string;
      [key: string]: any;
    }
}
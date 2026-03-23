/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_PERPLEXITY_API_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_SERP_API_KEY?: string;
  readonly VITE_GROK_API_KEY?: string;
  readonly VITE_XAI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SHEETS_API_URL: string;
  readonly VITE_SHEETS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

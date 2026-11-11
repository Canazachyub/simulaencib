/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USE_MOCK: string;
  readonly VITE_SINAPSIS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

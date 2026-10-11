/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" → el cliente usa fixtures y el simulador en lugar de la API real. */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

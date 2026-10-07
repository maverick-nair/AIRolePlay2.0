/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_PROVIDER?: "mock" | "http";
  readonly VITE_BUILD?: string;
}

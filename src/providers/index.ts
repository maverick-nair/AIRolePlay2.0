import { httpProviders } from "./http";
import { mockProviders } from "./mock";
import type { Providers } from "./types";

// The provider set is chosen at build time. "mock" is the default so the app runs without keys.
// Set VITE_AI_PROVIDER=http and run the API server (pnpm server) to use the Claude backed providers.
export function selectProviders(): Providers {
  const choice = import.meta.env.VITE_AI_PROVIDER ?? "mock";
  return choice === "http" ? httpProviders : mockProviders;
}

export const providers = selectProviders();
export type { Providers } from "./types";

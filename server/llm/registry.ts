import { AnthropicClient } from "./anthropic";
import { ProviderNotConfiguredError, type LlmClient, type ProviderId, type Route } from "./types";

// Builds (and caches) one client per route. Adding a provider means adding a case here and an
// adapter file; no job code changes. Providers listed without an adapter fail loudly at startup
// so a misrouted job is never silently served by the wrong model.

type Options = { timeoutMs: number; maxRetries: number };

const KEY_HINTS: Partial<Record<ProviderId, string>> = {
  anthropic: "set ANTHROPIC_API_KEY (or log in with the Anthropic CLI)",
  openai: "adapter not yet implemented; add server/llm/openai.ts and register it here",
  google: "adapter not yet implemented; add server/llm/google.ts and register it here",
  "azure-openai": "adapter not yet implemented; add server/llm/azureOpenai.ts and register it here",
  bedrock: "adapter not yet implemented; use @anthropic-ai/bedrock-sdk in server/llm/bedrock.ts",
  vertex: "adapter not yet implemented; use @anthropic-ai/vertex-sdk in server/llm/vertex.ts",
};

export class Registry {
  private cache = new Map<string, LlmClient>();
  constructor(private readonly options: Options) {}

  // "mock" routes return null: the job falls back to its offline implementation.
  clientFor(route: Route): LlmClient | null {
    if (route.provider === "mock") return null;
    const key = `${route.provider}:${route.model}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const client = this.create(route);
    this.cache.set(key, client);
    return client;
  }

  private create(route: Route): LlmClient {
    switch (route.provider) {
      case "anthropic":
        return new AnthropicClient(route.model, this.options);
      default:
        throw new ProviderNotConfiguredError(
          route.provider,
          KEY_HINTS[route.provider] ?? "no adapter registered",
        );
    }
  }

  // Called at startup so configuration errors surface before the first request.
  validate(routes: Route[]) {
    for (const r of routes) this.clientFor(r);
  }
}

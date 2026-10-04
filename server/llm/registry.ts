import { createAnthropic, createBedrock, createVertex, type ClaudeAuth, type CloudOptions } from "./claude";
import { ProviderNotConfiguredError, type LlmClient, type ProviderId, type Route } from "./types";

// Builds (and caches) one client per route. Adding a provider means adding a case here and an
// adapter file; no job code changes. Providers listed without an adapter fail loudly at startup
// so a misrouted job is never silently served by the wrong model.

type Options = { timeoutMs: number; maxRetries: number; auth: ClaudeAuth; cloud: CloudOptions };

const KEY_HINTS: Partial<Record<ProviderId, string>> = {
  anthropic:
    "set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN, or use LLM_AUTH_MODE=gateway with ANTHROPIC_BASE_URL",
  openai: "adapter not yet implemented; add server/llm/openai.ts and register it here",
  google: "adapter not yet implemented; add server/llm/google.ts and register it here",
  "azure-openai": "adapter not yet implemented; add server/llm/azureOpenai.ts and register it here",
  bedrock: "set LLM_BEDROCK_REGION or AWS_REGION",
  vertex: "set LLM_VERTEX_REGION and LLM_VERTEX_PROJECT_ID",
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
        return createAnthropic(route.model, this.options, this.options.auth);
      case "bedrock":
        return createBedrock(route.model, this.options, this.options.cloud);
      case "vertex":
        return createVertex(route.model, this.options, this.options.cloud);
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

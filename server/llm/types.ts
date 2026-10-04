import type { z } from "zod";

// Provider neutral contract for every LLM call the backend makes. Jobs (persona, classifier,
// report writer) code against this interface only, so a job can move to another provider or
// model through configuration alone. Anthropic is the first adapter; others register in registry.ts.

export const PROVIDERS = [
  "anthropic",
  "openai",
  "google",
  "azure-openai",
  "bedrock",
  "vertex",
  "mock",
] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const JOBS = ["npc", "classify", "report"] as const;
export type JobName = (typeof JOBS)[number];

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type Route = {
  provider: ProviderId;
  model: string;
  effort?: Effort;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type CompletionRequest = {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  effort?: Effort;
  // When true the adapter may cache the system prompt (prefix caching on providers that support it).
  cacheSystem?: boolean;
};

export type CompletionResult = {
  text: string;
  // The provider declined for safety reasons. Jobs treat this as "no answer", never as content.
  refused: boolean;
  usage: Usage;
  model: string;
};

export type ParseRequest<T> = CompletionRequest & {
  schema: z.ZodType<T>;
  schemaName: string;
};

export type ParseResult<T> = {
  parsed: T | null;
  refused: boolean;
  usage: Usage;
  model: string;
};

export interface LlmClient {
  readonly provider: ProviderId;
  readonly model: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  parse<T>(req: ParseRequest<T>): Promise<ParseResult<T>>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(
    public readonly provider: ProviderId,
    detail: string,
  ) {
    super(`Provider "${provider}" is not configured: ${detail}`);
    this.name = "ProviderNotConfiguredError";
  }
}

export const EMPTY_USAGE: Usage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

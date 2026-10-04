import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ProviderNotConfiguredError,
  type CompletionRequest,
  type CompletionResult,
  type LlmClient,
  type ParseRequest,
  type ParseResult,
  type ProviderId,
  type Usage,
} from "./types";

// One adapter for Claude on every platform. The first-party, Bedrock and Vertex clients expose the
// same `messages` resource, so the adapter is generic over the client and only the factory differs.
// No credential is read, stored or logged here: each client resolves auth from its own environment.

type ClaudeMessages = Pick<Anthropic.Messages, "create" | "parse">;
type ClaudeClient = { messages: ClaudeMessages };

export type AuthMode = "env" | "gateway";

export type ClaudeAuth = {
  // env: the SDK resolves credentials itself (API key, bearer token, workload identity or profile).
  // gateway: no credential leaves this process; the base URL is an internal gateway that
  // authenticates the request on the network path. Auth headers are explicitly omitted.
  mode: AuthMode;
  // Extra headers for a gateway (for example an internal routing or tenant header).
  gatewayHeaders: Record<string, string>;
};

export type CloudOptions = {
  bedrockRegion?: string;
  vertexRegion?: string;
  vertexProjectId?: string;
};

type Options = { timeoutMs: number; maxRetries: number };

function usageOf(u: Anthropic.Usage | undefined): Usage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  };
}

export class ClaudeAdapter implements LlmClient {
  constructor(
    readonly provider: ProviderId,
    readonly model: string,
    private readonly client: ClaudeClient,
  ) {}

  private system(req: CompletionRequest): Anthropic.TextBlockParam[] {
    return [
      req.cacheSystem
        ? { type: "text", text: req.system, cache_control: { type: "ephemeral" } }
        : { type: "text", text: req.system },
    ];
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens,
      system: this.system(req),
      messages: req.messages,
      ...(req.effort ? { output_config: { effort: req.effort } } : {}),
    });
    const refused = response.stop_reason === "refusal";
    const text = refused
      ? ""
      : response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join(" ")
          .trim();
    return { text, refused, usage: usageOf(response.usage), model: response.model };
  }

  async parse<T>(req: ParseRequest<T>): Promise<ParseResult<T>> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: req.maxTokens,
      system: this.system(req),
      messages: req.messages,
      output_config: {
        format: zodOutputFormat(req.schema),
        ...(req.effort ? { effort: req.effort } : {}),
      },
    });
    const refused = response.stop_reason === "refusal";
    return {
      parsed: refused ? null : (response.parsed_output ?? null),
      refused,
      usage: usageOf(response.usage),
      model: response.model,
    };
  }
}

// ---------- Factories ----------

export function createAnthropic(model: string, options: Options, auth: ClaudeAuth): LlmClient {
  const defaultHeaders =
    auth.mode === "gateway"
      ? // Omitting both auth headers tells the SDK that credentials are supplied by the network path.
        { "X-Api-Key": null, Authorization: null, ...auth.gatewayHeaders }
      : auth.gatewayHeaders;
  if (auth.mode === "gateway" && !process.env.ANTHROPIC_BASE_URL) {
    throw new ProviderNotConfiguredError(
      "anthropic",
      "LLM_AUTH_MODE=gateway needs ANTHROPIC_BASE_URL pointing at the internal gateway",
    );
  }
  const client = new Anthropic({
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries,
    defaultHeaders,
  });
  return new ClaudeAdapter("anthropic", model, client);
}

export function createBedrock(model: string, options: Options, cloud: CloudOptions): LlmClient {
  const awsRegion = cloud.bedrockRegion || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!awsRegion) {
    throw new ProviderNotConfiguredError(
      "bedrock",
      "set LLM_BEDROCK_REGION or AWS_REGION; credentials come from the AWS default chain",
    );
  }
  const client = new AnthropicBedrockMantle({
    awsRegion,
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries,
  });
  return new ClaudeAdapter("bedrock", model, client);
}

export function createVertex(model: string, options: Options, cloud: CloudOptions): LlmClient {
  const region = cloud.vertexRegion || process.env.CLOUD_ML_REGION;
  const projectId = cloud.vertexProjectId || process.env.ANTHROPIC_VERTEX_PROJECT_ID;
  if (!region || !projectId) {
    throw new ProviderNotConfiguredError(
      "vertex",
      "set LLM_VERTEX_REGION (or CLOUD_ML_REGION) and LLM_VERTEX_PROJECT_ID (or ANTHROPIC_VERTEX_PROJECT_ID); credentials come from Google application default credentials",
    );
  }
  const client = new AnthropicVertex({
    region,
    projectId,
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries,
  });
  return new ClaudeAdapter("vertex", model, client);
}

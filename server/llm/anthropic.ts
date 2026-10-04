import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type {
  CompletionRequest,
  CompletionResult,
  LlmClient,
  ParseRequest,
  ParseResult,
  Usage,
} from "./types";

// Claude adapter. Credentials are resolved by the SDK from the environment (ANTHROPIC_API_KEY,
// ANTHROPIC_AUTH_TOKEN or a local profile). No key is ever read or logged here.

function usageOf(u: Anthropic.Usage | undefined): Usage {
  return {
    inputTokens: u?.input_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: u?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
  };
}

export class AnthropicClient implements LlmClient {
  readonly provider = "anthropic" as const;
  private client: Anthropic;

  constructor(
    readonly model: string,
    options: { timeoutMs: number; maxRetries: number },
  ) {
    this.client = new Anthropic({ timeout: options.timeoutMs, maxRetries: options.maxRetries });
  }

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

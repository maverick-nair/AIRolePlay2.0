import type { JobConfig } from "../config";
import type { Registry } from "./registry";
import { EMPTY_USAGE, type JobName, type LlmClient, type Route, type Usage } from "./types";

// Runs one job against its configured route, with a fallback route on provider failure or refusal,
// and emits one JSON usage line per call so cost, latency and routing can be tracked per job.

export type RunOutcome<T> = {
  value: T | null;
  route: Route | null;
  model: string | null;
  usage: Usage;
  latencyMs: number;
  // "primary", "fallback" or "mock" (both routes failed or the job is routed to mock).
  servedBy: "primary" | "fallback" | "mock";
};

export type JobCall<T> = (
  client: LlmClient,
  route: Route,
) => Promise<{ value: T | null; usage: Usage; model: string }>;

export class Runner {
  constructor(
    private readonly registry: Registry,
    private readonly logUsage: boolean,
  ) {}

  async run<T>(job: JobName, config: JobConfig, call: JobCall<T>): Promise<RunOutcome<T>> {
    const attempts: { route: Route; servedBy: "primary" | "fallback" }[] = [
      { route: config.route, servedBy: "primary" },
    ];
    if (config.fallback) attempts.push({ route: config.fallback, servedBy: "fallback" });

    for (const attempt of attempts) {
      const client = this.registry.clientFor(attempt.route);
      if (!client) break; // routed to mock
      const started = Date.now();
      try {
        const result = await call(client, attempt.route);
        const latencyMs = Date.now() - started;
        this.log({
          job,
          route: attempt.route,
          model: result.model,
          usage: result.usage,
          latencyMs,
          ok: result.value !== null,
        });
        if (result.value !== null)
          return { ...result, route: attempt.route, latencyMs, servedBy: attempt.servedBy };
      } catch (err) {
        this.log({
          job,
          route: attempt.route,
          model: client.model,
          usage: EMPTY_USAGE,
          latencyMs: Date.now() - started,
          ok: false,
          error: err instanceof Error ? err.name : "error",
        });
      }
    }
    return { value: null, route: null, model: null, usage: EMPTY_USAGE, latencyMs: 0, servedBy: "mock" };
  }

  private log(entry: {
    job: JobName;
    route: Route;
    model: string;
    usage: Usage;
    latencyMs: number;
    ok: boolean;
    error?: string;
  }) {
    if (!this.logUsage) return;
    console.log(
      JSON.stringify({
        type: "llm_usage",
        at: new Date().toISOString(),
        job: entry.job,
        provider: entry.route.provider,
        model: entry.model,
        effort: entry.route.effort ?? null,
        ...entry.usage,
        latencyMs: entry.latencyMs,
        ok: entry.ok,
        ...(entry.error ? { error: entry.error } : {}),
      }),
    );
  }
}

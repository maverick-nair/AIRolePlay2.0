import type { AuthMode, ClaudeAuth, CloudOptions } from "./llm/claude";
import { JOBS, PROVIDERS, type Effort, type JobName, type ProviderId, type Route } from "./llm/types";

// All backend configuration comes from the environment. Nothing here has a model id as a default:
// the deployment decides which provider and model each job uses, and can change it per job on
// cost, speed, security or accuracy grounds without touching code.
//
//   LLM_ROUTE_<JOB>     provider:model[:effort]   e.g. anthropic:claude-opus-5-5:medium
//   LLM_ROUTE_DEFAULT   used for any job without its own route
//   LLM_FALLBACK_<JOB>  route tried when the primary route fails (provider error or refusal)
//   PROMPT_VERSION_<JOB> prompt file version under /prompts/<job>/ (default v1)
//
// Credentials never appear in config. LLM_AUTH_MODE chooses how Claude calls authenticate:
//   env      the SDK resolves them (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, workload identity, profile)
//   gateway  none leave this process; ANTHROPIC_BASE_URL is an internal gateway that authenticates
//            the request on the network path (optional LLM_GATEWAY_HEADERS as a JSON object)
// Bedrock and Vertex use cloud identity (AWS default chain, Google application default credentials).
//
// Jobs: NPC (persona), CLASSIFY (turn classifier), REPORT (report writer).

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

export function parseRoute(value: string | undefined, source: string): Route | null {
  if (!value || !value.trim()) return null;
  const [provider, model, effort] = value.split(":").map((s) => s.trim());
  if (!PROVIDERS.includes(provider as ProviderId)) {
    throw new Error(`${source}: unknown provider "${provider}". Known: ${PROVIDERS.join(", ")}`);
  }
  if (provider !== "mock" && !model)
    throw new Error(`${source}: a model id is required for provider "${provider}"`);
  if (effort && !EFFORTS.includes(effort as Effort)) {
    throw new Error(`${source}: unknown effort "${effort}". Known: ${EFFORTS.join(", ")}`);
  }
  return {
    provider: provider as ProviderId,
    model: model ?? "",
    ...(effort ? { effort: effort as Effort } : {}),
  };
}

export type JobConfig = {
  route: Route;
  fallback: Route | null;
  promptVersion: string;
};

export type ServerConfig = {
  port: number;
  dualPass: boolean;
  timeoutMs: number;
  maxRetries: number;
  logUsage: boolean;
  auth: ClaudeAuth;
  cloud: CloudOptions;
  jobs: Record<JobName, JobConfig>;
};

function parseAuth(env: NodeJS.ProcessEnv): ClaudeAuth {
  const mode = (env.LLM_AUTH_MODE?.trim() || "env") as AuthMode;
  if (mode !== "env" && mode !== "gateway") {
    throw new Error(`LLM_AUTH_MODE: unknown mode "${mode}". Known: env, gateway`);
  }
  const gatewayHeaders: Record<string, string> = {};
  if (env.LLM_GATEWAY_HEADERS?.trim()) {
    const parsed: unknown = JSON.parse(env.LLM_GATEWAY_HEADERS);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("LLM_GATEWAY_HEADERS must be a JSON object of header names to values");
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== "string") throw new Error(`LLM_GATEWAY_HEADERS: header "${k}" must be a string`);
      gatewayHeaders[k] = v;
    }
  }
  return { mode, gatewayHeaders };
}

// Which credential sources are present, by name only. Never values.
export function credentialSources(env: NodeJS.ProcessEnv = process.env): string[] {
  const names = [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_PROFILE",
    "ANTHROPIC_IDENTITY_TOKEN_FILE",
    "AWS_ACCESS_KEY_ID",
    "AWS_PROFILE",
    "AWS_WEB_IDENTITY_TOKEN_FILE",
    "GOOGLE_APPLICATION_CREDENTIALS",
  ];
  return names.filter((n) => Boolean(env[n]));
}

const MOCK_ROUTE: Route = { provider: "mock", model: "" };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const defaultRoute = parseRoute(env.LLM_ROUTE_DEFAULT, "LLM_ROUTE_DEFAULT") ?? MOCK_ROUTE;
  const jobs = {} as Record<JobName, JobConfig>;
  for (const job of JOBS) {
    const key = job.toUpperCase();
    jobs[job] = {
      route: parseRoute(env[`LLM_ROUTE_${key}`], `LLM_ROUTE_${key}`) ?? defaultRoute,
      fallback: parseRoute(env[`LLM_FALLBACK_${key}`], `LLM_FALLBACK_${key}`),
      promptVersion: env[`PROMPT_VERSION_${key}`]?.trim() || "v1",
    };
  }
  return {
    port: Number(env.ROLEPLAY_API_PORT ?? 8787),
    dualPass: env.ROLEPLAY_DUAL_PASS === "1",
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 60_000),
    maxRetries: Number(env.LLM_MAX_RETRIES ?? 2),
    logUsage: env.LLM_LOG_USAGE !== "0",
    auth: parseAuth(env),
    cloud: {
      bedrockRegion: env.LLM_BEDROCK_REGION?.trim() || undefined,
      vertexRegion: env.LLM_VERTEX_REGION?.trim() || undefined,
      vertexProjectId: env.LLM_VERTEX_PROJECT_ID?.trim() || undefined,
    },
    jobs,
  };
}

// Safe to expose on the health route: routes and versions, never credentials.
export function describeConfig(config: ServerConfig) {
  const routeText = (r: Route | null) =>
    r ? `${r.provider}${r.model ? `:${r.model}` : ""}${r.effort ? `:${r.effort}` : ""}` : null;
  return {
    dualPass: config.dualPass,
    authMode: config.auth.mode,
    gatewayHeaderNames: Object.keys(config.auth.gatewayHeaders),
    credentialSources: credentialSources(),
    jobs: Object.fromEntries(
      JOBS.map((job) => [
        job,
        {
          route: routeText(config.jobs[job].route),
          fallback: routeText(config.jobs[job].fallback),
          promptVersion: config.jobs[job].promptVersion,
        },
      ]),
    ),
  };
}

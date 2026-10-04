import Anthropic from "@anthropic-ai/sdk";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { describeConfig, loadConfig } from "./config";
import { makeClassifyJob } from "./jobs/classify";
import { makeNpcJob } from "./jobs/npc";
import { makeReportJob } from "./jobs/report";
import { Registry } from "./llm/registry";
import { Runner } from "./llm/runner";
import { ProviderNotConfiguredError } from "./llm/types";
import { ClassifyRequest, NpcRequest, ReportRequest } from "../src/providers/types";

// API server for AI RolePlay. It is the only process that holds provider credentials. Each route
// validates its input with Zod, runs its job through the configured LLM route (with fallback), and
// returns a response the client validates again. Jobs routed to "mock" use the offline providers.

const config = loadConfig();
const registry = new Registry({
  timeoutMs: config.timeoutMs,
  maxRetries: config.maxRetries,
  auth: config.auth,
  cloud: config.cloud,
});
try {
  registry.validate(
    Object.values(config.jobs).flatMap((j) => (j.fallback ? [j.route, j.fallback] : [j.route])),
  );
} catch (err) {
  if (err instanceof ProviderNotConfiguredError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
const runner = new Runner(registry, config.logUsage);

const npc = makeNpcJob(runner, config.jobs.npc);
const classify = makeClassifyJob(runner, config.jobs.classify, config.dualPass);
const report = makeReportJob(runner, config.jobs.report);

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const routes: Record<string, (body: unknown) => Promise<unknown>> = {
  "/api/npc": (b) => npc(NpcRequest.parse(b)),
  "/api/classify": (b) => classify(ClassifyRequest.parse(b)),
  "/api/report": (b) => report(ReportRequest.parse(b)),
  "/api/health": async () => ({ ok: true, ...describeConfig(config) }),
};

createServer(async (req, res) => {
  const path = (req.url ?? "").split("?")[0];
  const route = routes[path];
  if (!route) return send(res, 404, { error: "Not found" });
  try {
    const body = req.method === "POST" ? await readJson(req) : null;
    send(res, 200, await route(body));
  } catch (err) {
    if (err instanceof z.ZodError) return send(res, 400, { error: "Invalid request", issues: err.issues });
    if (err instanceof Anthropic.AuthenticationError)
      return send(res, 502, { error: "Provider authentication failed" });
    if (err instanceof Anthropic.RateLimitError) return send(res, 503, { error: "Provider rate limited" });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: `Provider error ${err.status}` });
    console.error(err);
    send(res, 500, { error: "Internal error" });
  }
}).listen(config.port, () => {
  const summary = describeConfig(config).jobs;
  console.log(`AI RolePlay API on http://localhost:${config.port}  auth mode ${config.auth.mode}`);
  for (const [job, j] of Object.entries(summary))
    console.log(
      `  ${job.padEnd(9)} ${j.route}${j.fallback ? `  (fallback ${j.fallback})` : ""}  prompt ${j.promptVersion}`,
    );
});

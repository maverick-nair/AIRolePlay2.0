import {
  ClassifyResponse,
  NpcResponse,
  ReportNarrative,
  type ClassifyRequest,
  type NpcRequest,
  type Providers,
  type ReportRequest,
} from "./types";
import { mockProviders } from "./mock";

// Providers that call the local API server (see server/index.ts), which holds the provider key.
// Every response is validated with Zod before it reaches the engine. If the server is unreachable
// the call falls back to the mock so a session is never lost, and the report records the provider.

async function post<T>(path: string, body: unknown, parse: (data: unknown) => T): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
  return parse(await res.json());
}

export const httpProviders: Providers = {
  name: "http",
  npc: {
    async reply(req: NpcRequest) {
      try {
        return await post("/api/npc", req, (d) => NpcResponse.parse(d));
      } catch (err) {
        console.warn("NPC provider unavailable, using the scripted persona", err);
        return mockProviders.npc.reply(req);
      }
    },
  },
  classifier: {
    async classify(req: ClassifyRequest) {
      try {
        return await post("/api/classify", req, (d) => ClassifyResponse.parse(d));
      } catch (err) {
        console.warn("Classifier unavailable, using the heuristic classifier", err);
        return mockProviders.classifier.classify(req);
      }
    },
  },
  reporter: {
    async write(req: ReportRequest) {
      try {
        return await post("/api/report", req, (d) => ReportNarrative.parse(d));
      } catch (err) {
        console.warn("Report writer unavailable, using the template writer", err);
        return mockProviders.reporter.write(req);
      }
    },
  },
};

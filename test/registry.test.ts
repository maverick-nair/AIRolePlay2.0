import { describe, expect, it } from "vitest";
import { loadConfig } from "../server/config";
import { Registry } from "../server/llm/registry";
import { ProviderNotConfiguredError } from "../server/llm/types";

// Construction only: no network. Verifies that every supported provider can be built from
// configuration without an API key, and that misconfiguration fails loudly at startup.

const base = { timeoutMs: 1000, maxRetries: 0 };

describe("provider registry", () => {
  it("returns null for mock routes so jobs use the offline implementation", () => {
    const r = new Registry({ ...base, auth: { mode: "env", gatewayHeaders: {} }, cloud: {} });
    expect(r.clientFor({ provider: "mock", model: "" })).toBeNull();
  });

  it("builds a first party Claude client in gateway mode without any key when a base URL is set", () => {
    const prev = process.env.ANTHROPIC_BASE_URL;
    process.env.ANTHROPIC_BASE_URL = "http://gateway.internal/anthropic";
    try {
      const r = new Registry({
        ...base,
        auth: { mode: "gateway", gatewayHeaders: { "X-Tenant": "t1" } },
        cloud: {},
      });
      const c = r.clientFor({ provider: "anthropic", model: "m" });
      expect(c?.provider).toBe("anthropic");
      expect(c?.model).toBe("m");
    } finally {
      if (prev === undefined) delete process.env.ANTHROPIC_BASE_URL;
      else process.env.ANTHROPIC_BASE_URL = prev;
    }
  });

  it("refuses gateway mode without a base URL", () => {
    const prev = process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_BASE_URL;
    try {
      const r = new Registry({ ...base, auth: { mode: "gateway", gatewayHeaders: {} }, cloud: {} });
      expect(() => r.clientFor({ provider: "anthropic", model: "m" })).toThrow(ProviderNotConfiguredError);
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_BASE_URL = prev;
    }
  });

  it("builds Bedrock and Vertex clients from cloud options, using cloud identity rather than a key", () => {
    const r = new Registry({
      ...base,
      auth: { mode: "env", gatewayHeaders: {} },
      cloud: { bedrockRegion: "us-east-1", vertexRegion: "global", vertexProjectId: "proj" },
    });
    expect(r.clientFor({ provider: "bedrock", model: "anthropic.claude-x" })?.provider).toBe("bedrock");
    expect(r.clientFor({ provider: "vertex", model: "claude-x" })?.provider).toBe("vertex");
  });

  it("refuses Vertex without a project and reserved providers without an adapter", () => {
    const r = new Registry({
      ...base,
      auth: { mode: "env", gatewayHeaders: {} },
      cloud: { bedrockRegion: "us-east-1" },
    });
    expect(() => r.clientFor({ provider: "vertex", model: "m" })).toThrow(/LLM_VERTEX_PROJECT_ID/);
    expect(() => r.clientFor({ provider: "openai", model: "m" })).toThrow(/not yet implemented/);
  });

  it("caches one client per route", () => {
    const r = new Registry({
      ...base,
      auth: { mode: "env", gatewayHeaders: {} },
      cloud: { bedrockRegion: "eu-west-1" },
    });
    const a = r.clientFor({ provider: "bedrock", model: "m" });
    const b = r.clientFor({ provider: "bedrock", model: "m" });
    expect(a).toBe(b);
  });
});

describe("auth config", () => {
  it("defaults to env mode and parses gateway headers", () => {
    expect(loadConfig({} as NodeJS.ProcessEnv).auth).toEqual({ mode: "env", gatewayHeaders: {} });
    const c = loadConfig({
      LLM_AUTH_MODE: "gateway",
      LLM_GATEWAY_HEADERS: '{"X-Tenant":"acme"}',
    } as NodeJS.ProcessEnv);
    expect(c.auth).toEqual({ mode: "gateway", gatewayHeaders: { "X-Tenant": "acme" } });
  });

  it("rejects unknown modes and malformed headers", () => {
    expect(() => loadConfig({ LLM_AUTH_MODE: "magic" } as NodeJS.ProcessEnv)).toThrow(/unknown mode/);
    expect(() => loadConfig({ LLM_GATEWAY_HEADERS: '["x"]' } as NodeJS.ProcessEnv)).toThrow(/JSON object/);
    expect(() => loadConfig({ LLM_GATEWAY_HEADERS: '{"a":1}' } as NodeJS.ProcessEnv)).toThrow(
      /must be a string/,
    );
  });

  it("carries cloud options", () => {
    const c = loadConfig({
      LLM_BEDROCK_REGION: "ap-south-1",
      LLM_VERTEX_REGION: "global",
      LLM_VERTEX_PROJECT_ID: "p",
    } as NodeJS.ProcessEnv);
    expect(c.cloud).toEqual({ bedrockRegion: "ap-south-1", vertexRegion: "global", vertexProjectId: "p" });
  });
});

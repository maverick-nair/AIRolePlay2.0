import { describe, expect, it } from "vitest";
import { describeConfig, loadConfig, parseRoute } from "../server/config";
import { reconcile } from "../server/jobs/classify";

describe("LLM routing config", () => {
  it("parses provider, model and effort", () => {
    expect(parseRoute("anthropic:claude-opus-5-5:medium", "x")).toEqual({
      provider: "anthropic",
      model: "claude-opus-5-5",
      effort: "medium",
    });
    expect(parseRoute("mock", "x")).toEqual({ provider: "mock", model: "" });
    expect(parseRoute("", "x")).toBeNull();
  });

  it("rejects unknown providers, missing models and unknown effort", () => {
    expect(() => parseRoute("llama:foo", "LLM_ROUTE_NPC")).toThrow(/unknown provider/);
    expect(() => parseRoute("anthropic", "LLM_ROUTE_NPC")).toThrow(/model id is required/);
    expect(() => parseRoute("anthropic:m:turbo", "LLM_ROUTE_NPC")).toThrow(/unknown effort/);
  });

  it("routes each job independently with a default and fallback", () => {
    const c = loadConfig({
      LLM_ROUTE_DEFAULT: "anthropic:model-a",
      LLM_ROUTE_NPC: "anthropic:model-b:low",
      LLM_FALLBACK_NPC: "mock",
      PROMPT_VERSION_CLASSIFY: "v2",
      ROLEPLAY_DUAL_PASS: "1",
    } as NodeJS.ProcessEnv);
    expect(c.jobs.npc.route).toEqual({ provider: "anthropic", model: "model-b", effort: "low" });
    expect(c.jobs.npc.fallback).toEqual({ provider: "mock", model: "" });
    expect(c.jobs.classify.route.model).toBe("model-a");
    expect(c.jobs.classify.promptVersion).toBe("v2");
    expect(c.jobs.report.promptVersion).toBe("v2");
    expect(c.dualPass).toBe(true);
  });

  it("defaults every job to mock when nothing is configured", () => {
    const c = loadConfig({} as NodeJS.ProcessEnv);
    expect(Object.values(c.jobs).every((j) => j.route.provider === "mock")).toBe(true);
    expect(describeConfig(c).jobs.npc.route).toBe("mock");
  });

  it("never exposes credentials in the description", () => {
    const c = loadConfig({
      ANTHROPIC_API_KEY: "secret",
      LLM_ROUTE_DEFAULT: "anthropic:m",
    } as NodeJS.ProcessEnv);
    expect(JSON.stringify(describeConfig(c))).not.toContain("secret");
  });
});

describe("dual pass reconciliation", () => {
  const hit = (indicatorId: string, band: "Strong" | "Adequate" | "Weak" | "Harmful") => ({
    indicatorId,
    band,
    quote: "q",
    note: "n",
  });
  it("keeps the more conservative band on disagreement and reports agreement", () => {
    const { hits, agreement } = reconcile(
      [hit("a", "Strong"), hit("b", "Adequate")],
      [hit("a", "Weak"), hit("b", "Adequate"), hit("c", "Strong")],
    );
    expect(hits.find((h) => h.indicatorId === "a")?.band).toBe("Weak");
    expect(hits.length).toBe(3);
    expect(agreement).toBeCloseTo(1 / 3);
  });
});

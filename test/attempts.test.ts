import { beforeEach, describe, expect, it } from "vitest";
import { assessmentAttempt, listAttempts, saveAttempt } from "../src/store/attempts";
import type { Report } from "../src/domain/report";

// A minimal in-memory localStorage, so the store can be exercised under Node.
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  has(k: string) {
    return this.map.has(k);
  }
}

const report = (id: string, mode: "practice" | "assessment") =>
  ({ id, scenarioId: "renewal-negotiation", mode, completedAt: `2026-10-07T10:00:0${id.length}Z` }) as Report;

describe("attempt store reset", () => {
  let store: MemoryStorage;
  beforeEach(() => {
    store = new MemoryStorage();
    (globalThis as { localStorage?: unknown }).localStorage = store;
  });

  it("ignores attempts saved under the retired key and removes it", () => {
    store.setItem(
      "gk.roleplay.attempts.v1",
      JSON.stringify([report("a", "assessment"), report("bb", "practice")]),
    );
    expect(assessmentAttempt("renewal-negotiation")).toBeNull();
    expect(listAttempts("renewal-negotiation", "practice")).toHaveLength(0);
    expect(store.has("gk.roleplay.attempts.v1")).toBe(false);
  });

  it("still saves and locks the assessment under the current key", () => {
    saveAttempt(report("a", "assessment"));
    expect(assessmentAttempt("renewal-negotiation")?.id).toBe("a");
  });
});

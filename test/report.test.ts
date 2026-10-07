import { describe, expect, it } from "vitest";
import { renewalNegotiation as scenario } from "../src/data/scenarios/renewalNegotiation";
import { opportunityFor, opportunityLine } from "../src/domain/report";
import { validateScenario } from "../src/domain/scenario";
import { mockProviders } from "../src/providers/mock";

const M = "Margaret Hale";
const transcript = [
  ...scenario.stimulus.opening,
  { speaker: M, time: "2:00", text: "We have a cheaper quote." },
  { speaker: "You", time: "2:02", text: "What matters most to you this year?" },
  { speaker: M, time: "2:04", text: "Their quote covers the core platform. Onboarding is extra." },
  { speaker: "You", time: "2:06", text: "Thanks." },
  { speaker: M, time: "2:08", text: "Show me hard savings in our own numbers." },
];

describe("opportunityFor", () => {
  it("every authored link points at a real indicator", () => {
    const ids = new Set(scenario.instrument.skills.flatMap((s) => s.indicators.map((i) => i.id)));
    for (const inc of scenario.stimulus.incidents)
      for (const id of inc.opportunityFor) expect(ids.has(id)).toBe(true);
    expect(() => validateScenario(scenario)).not.toThrow();
  });

  it("finds the persona line where the incident landed", () => {
    const o = opportunityFor(scenario, transcript, "strategy.batna");
    expect(o).toMatchObject({
      kind: "moment",
      time: "2:04",
      incidentLabel: "The fine print",
      turnIndex: scenario.stimulus.opening.length + 2,
    });
    const later = opportunityFor(scenario, transcript, "value.business-impact");
    expect(later).toMatchObject({ kind: "moment", time: "2:08" });
  });

  it("says when the call ended before the moment", () => {
    const o = opportunityFor(scenario, transcript, "strategy.next-steps");
    expect(o).toEqual({ kind: "not-reached", incidentLabel: "Friday is real" });
    expect(opportunityLine(o, "Margaret")).toMatch(/call ended before friday is real/);
  });

  it("ignores player lines in the scripted opening", () => {
    const openingOnly = [...scenario.stimulus.opening];
    expect(opportunityFor(scenario, openingOnly, "strategy.batna").kind).toBe("not-reached");
  });

  it("treats indicators without an incident as a chance on every turn", () => {
    expect(opportunityFor(scenario, transcript, "probing.open-questions")).toEqual({ kind: "every-turn" });
  });

  it("the mock narrative cites the missed moment instead of a template", async () => {
    const skills = scenario.instrument.skills.map((s) => ({
      skillId: s.id,
      name: s.name,
      score: 4,
      indicators: s.indicators.map((i) => ({ indicatorId: i.id, label: i.label, band: null, quotes: [] })),
    }));
    const n = await mockProviders.reporter.write({ scenario, transcript, skills, overall: 4 });
    const text = n.overall.join(" ");
    expect(text).toMatch(/at 2:04, when Margaret said "Their quote covers the core platform\."/);
    expect(text).not.toMatch(/gave an opportunity/);
  });
});

import { describe, expect, it } from "vitest";
import { renewalNegotiation as scenario } from "../src/data/scenarios/renewalNegotiation";
import { describeTranscript } from "../src/domain/descriptive";
import { claimLadder } from "../src/domain/instrumentStatus";
import { assembleReport, tagTranscript } from "../src/domain/report";
import { validateScenario, type TurnClassification } from "../src/domain/scenario";
import {
  BAND_POINTS,
  NOT_OBSERVED_POINTS,
  bandFromPoints,
  hintFor,
  levelFor,
  levelProgress,
  nextLevel,
  rankAmong,
  totalXp,
  practiceRunsLeft,
  scoreSession,
  scoreSkill,
  turnOutcome,
} from "../src/domain/scoring";
import { classifyHeuristically, mockProviders } from "../src/providers/mock";

const hit = (
  indicatorId: string,
  band: "Strong" | "Adequate" | "Weak" | "Harmful",
  turnIndex = 0,
): TurnClassification => ({
  turnIndex,
  onTopic: true,
  hits: [{ indicatorId, band, quote: "q", note: "n" }],
});

describe("scenario schema", () => {
  it("validates the authored scenario and its objective references", () => {
    expect(() => validateScenario(scenario)).not.toThrow();
    expect(scenario.instrument.skills.reduce((a, s) => a + s.weight, 0)).toBe(100);
  });
  it("rejects objectives that point at unknown indicators", () => {
    const broken = structuredClone(scenario);
    broken.instrument.objectives[0].indicatorIds = ["nope"];
    expect(() => validateScenario(broken)).toThrow(/unknown indicator/);
  });
});

describe("indicator and skill scoring", () => {
  const strategy = scenario.instrument.skills[0];

  it("scores unobserved indicators as Weak, not as missing", () => {
    const r = scoreSkill(strategy, []);
    expect(r.observedCount).toBe(0);
    expect(r.indicators.every((i) => i.points === NOT_OBSERVED_POINTS)).toBe(true);
    expect(r.score).toBe(NOT_OBSERVED_POINTS);
  });

  it("averages repeated hits so one strong turn cannot hide a harmful one", () => {
    const r = scoreSkill(strategy, [
      hit("strategy.anchor", "Strong", 1),
      hit("strategy.anchor", "Harmful", 3),
    ]);
    const anchor = r.indicators.find((i) => i.indicatorId === "strategy.anchor")!;
    expect(anchor.points).toBe((BAND_POINTS.Strong + BAND_POINTS.Harmful) / 2);
    expect(anchor.band).toBe("Adequate");
    expect(r.hasHarmful).toBe(false);
  });

  it("maps points back to bands at the documented cut points", () => {
    expect(bandFromPoints(10)).toBe("Strong");
    expect(bandFromPoints(8.5)).toBe("Strong");
    expect(bandFromPoints(7)).toBe("Adequate");
    expect(bandFromPoints(4)).toBe("Weak");
    expect(bandFromPoints(1)).toBe("Harmful");
  });

  it("weights skills into the overall score and reports coverage", () => {
    const all = scenario.instrument.skills.flatMap((s) => s.indicators.map((i, k) => hit(i.id, "Strong", k)));
    const perfect = scoreSession(scenario, all);
    expect(perfect.overall).toBe(10);
    expect(perfect.coverage).toBe(1);
    expect(perfect.passed).toBe(true);
    const empty = scoreSession(scenario, []);
    expect(empty.overall).toBe(4);
    expect(empty.coverage).toBe(0);
    expect(empty.passed).toBe(false);
  });
});

describe("turn outcome (gamification rules)", () => {
  const base = { scenario, metObjectives: [false, false, false], streak: 0, xp: 560, badges: [] as string[] };

  it("earns nothing and breaks the streak when off topic", () => {
    const o = turnOutcome({
      ...base,
      streak: 2,
      text: "nice weather today",
      classification: { turnIndex: 5, onTopic: false, hits: [] },
    });
    expect(o.gain).toBe(0);
    expect(o.nextStreak).toBe(0);
    expect(o.earnedBadges).toEqual([]);
  });

  it("completes an objective only from an Adequate or better band on a listed indicator", () => {
    const weak = turnOutcome({
      ...base,
      text: "what does the quote include?",
      classification: hit("probing.open-questions", "Weak", 5),
    });
    expect(weak.newlyMet).toEqual([false, false, false]);
    const strong = turnOutcome({
      ...base,
      text: "what does the quote include?",
      classification: hit("probing.open-questions", "Strong", 5),
    });
    expect(strong.newlyMet).toEqual([true, false, false]);
    expect(strong.earnedBadges).toContain("detective");
    expect(strong.earnedBadges).toContain("icebreaker");
    expect(strong.gain).toBe(25 + 45 + 5);
  });

  it("applies the streak multiplier from the third strong reply", () => {
    const o = turnOutcome({
      ...base,
      streak: 2,
      text: "one two three four five",
      classification: hit("relationship.tone", "Strong", 7),
    });
    expect(o.multiplied).toBe(true);
    expect(o.gain).toBe(Math.round((25 + 5) * 1.5));
    expect(o.earnedBadges).toContain("hot-streak");
  });

  it("awards clean sweep when the last objective lands", () => {
    const o = turnOutcome({
      ...base,
      metObjectives: [true, true, false],
      text: "it sounds like you need savings you can show upstairs",
      classification: hit("listening.paraphrase", "Strong", 9),
    });
    expect(o.earnedBadges).toEqual(expect.arrayContaining(["listener", "clean-sweep"]));
  });

  it("levels up across the 700 XP boundary", () => {
    const o = turnOutcome({
      ...base,
      xp: 690,
      text: "what is behind that for your cfo?",
      classification: hit("probing.follow-up", "Strong", 2),
    });
    expect(o.levelledUp).toBe(true);
    expect(levelFor(0).name).toBe("Newcomer");
    expect(levelFor(299).name).toBe("Newcomer");
    expect(levelFor(690).name).toBe("Competent");
    expect(levelFor(700).name).toBe("Proficient");
  });
});

describe("heuristic classifier", () => {
  it("recognises a conditional concession as Strong and an unconditional one as Weak", () => {
    const strong = classifyHeuristically(
      scenario,
      "If you can commit to a three-year term, I can look at 8% off.",
      0,
    );
    expect(strong.hits.find((h) => h.indicatorId === "strategy.conditional-concession")?.band).toBe("Strong");
    const weak = classifyHeuristically(scenario, "I could probably look at around 10% off if that helps.", 0);
    expect(weak.hits.find((h) => h.indicatorId === "strategy.conditional-concession")?.band).toBe("Weak");
  });
  it("treats matching the rival price as giving up the anchor, not as collaboration", () => {
    const c = classifyHeuristically(scenario, "We can match their price.", 0);
    expect(c.hits.find((h) => h.indicatorId === "strategy.anchor")?.band).toBe("Weak");
    expect(c.hits.find((h) => h.indicatorId === "relationship.tone")).toBeUndefined();
    expect(hintFor(scenario, [c])).not.toBeNull();
  });
  it("still credits a genuinely collaborative line", () => {
    const c = classifyHeuristically(scenario, "Let's work together on a plan your CFO can sign.", 0);
    expect(c.hits.find((h) => h.indicatorId === "relationship.tone")?.band).toBe("Strong");
  });
  it("flags hostile language as Harmful", () => {
    const c = classifyHeuristically(scenario, "That's ridiculous, take it or leave it.", 0);
    expect(c.hits.some((h) => h.band === "Harmful")).toBe(true);
  });
  it("marks a reply with no scenario vocabulary as off topic", () => {
    expect(classifyHeuristically(scenario, "I had pasta for lunch.", 0).onTopic).toBe(false);
  });
});

describe("hints", () => {
  it("returns the indicator's authored hint after a weak band", () => {
    const h = hintFor(scenario, [hit("strategy.conditional-concession", "Weak", 3)]);
    expect(h).toBe("That concession had no condition. Ask for something back.");
  });
  it("nudges towards a question after two turns without probing", () => {
    const h = hintFor(scenario, [
      hit("relationship.tone", "Strong", 1),
      hit("relationship.tone", "Strong", 2),
    ]);
    expect(h).toBe("Ask an open question: what, how or why.");
  });
});

describe("descriptive metrics", () => {
  it("counts questions, open questions and talk share from the transcript", () => {
    const m = describeTranscript([
      { speaker: "Margaret Hale", time: "0:01", text: "Lower cost, plain and simple." },
      {
        speaker: "You",
        time: "0:02",
        text: "What does the quote include? Is onboarding in there? I can do 10% off.",
      },
    ]);
    expect(m.questions).toBe(2);
    expect(m.openQuestions).toBe(1);
    expect(m.closedQuestions).toBe(1);
    expect(m.unconditionalOffers).toBe(1);
    expect(m.talkShare).toBeGreaterThan(0.5);
  });
});

describe("report assembly", () => {
  it("builds a report whose tags come only from the evidence", async () => {
    const transcript = [
      ...scenario.stimulus.opening,
      { speaker: "You", time: "3:00", text: "If you can do a three-year term, I can protect the price." },
    ];
    const classifications = [hit("strategy.conditional-concession", "Strong", 5)];
    const narrative = await mockProviders.reporter.write({
      scenario,
      transcript,
      overall: 5,
      skills: scenario.instrument.skills.map((s) => ({
        skillId: s.id,
        name: s.name,
        score: 5,
        indicators: s.indicators.map((i) => ({ indicatorId: i.id, label: i.label, band: null, quotes: [] })),
      })),
    });
    const report = assembleReport({
      id: "T-1",
      scenario,
      mode: "practice",
      completedAt: "2026-10-04T10:00:00.000Z",
      durationSeconds: 300,
      transcript,
      classifications,
      narrative,
      stats: { startXp: 560, endXp: 600, badges: [], bestStreak: 1, objectives: 1, startRank: 4, endRank: 4 },
      agreement: null,
    });
    const tagged = tagTranscript(report);
    expect(tagged.filter((t) => t.tag).length).toBe(1);
    expect(tagged[5].tag).toBe("strength");
    expect(report.scores.skills.find((s) => s.id === "strategy")!.indicators[1].band).toBe("Strong");
    expect(narrative.language).toBeNull();
  });
});

describe("claim ladder", () => {
  it("marks the scenario's rung as current and higher rungs as ahead", () => {
    const ladder = claimLadder(scenario.instrument.claimRung);
    expect(ladder[0].state).toBe("current");
    expect(ladder[3].state).toBe("ahead");
  });
});

describe("progress from saved runs", () => {
  it("starts at zero XP, as a Newcomer, with progress towards Emerging", () => {
    expect(totalXp([])).toBe(0);
    expect(levelFor(totalXp([])).name).toBe("Newcomer");
    expect(nextLevel(0)?.name).toBe("Emerging");
    expect(levelProgress(150)).toBe(50);
  });
  it("adds only what each run earned", () => {
    expect(
      totalXp([
        { startXp: 0, endXp: 180 },
        { startXp: 180, endXp: 300 },
      ]),
    ).toBe(300);
    // Runs saved by older builds started from a seeded 560: only the earned part counts.
    expect(totalXp([{ startXp: 560, endXp: 805 }])).toBe(245);
  });
  it("ranks against the board, top first", () => {
    expect(rankAmong(0, [940, 815, 690, 555, 430])).toBe(6);
    expect(rankAmong(700, [940, 815, 690, 555, 430])).toBe(3);
    expect(rankAmong(1000, [940, 815])).toBe(1);
  });
  it("has no next level at the top", () => {
    expect(nextLevel(950)).toBeNull();
    expect(levelProgress(950)).toBe(25);
  });
});

describe("practice run cap", () => {
  it("defaults a scenario to five practice runs", () => {
    expect(scenario.maxPracticeAttempts).toBe(5);
  });
  it("counts down and never goes negative", () => {
    expect(practiceRunsLeft(0, 5)).toBe(5);
    expect(practiceRunsLeft(4, 5)).toBe(1);
    expect(practiceRunsLeft(5, 5)).toBe(0);
    expect(practiceRunsLeft(7, 5)).toBe(0);
  });
});

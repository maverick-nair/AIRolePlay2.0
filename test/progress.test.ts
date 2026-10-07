import { describe, expect, it } from "vitest";
import { dayStreak, weekStrip, weeklyQuests, xpToday } from "../src/lib/progress";
import type { Report } from "../src/domain/report";

// Wednesday 7 October 2026, midday local time.
const NOW = new Date(2026, 9, 7, 12, 0);
const run = (y: number, m: number, d: number, extra: Partial<Report> = {}) =>
  ({
    completedAt: new Date(y, m, d, 10, 0).toISOString(),
    stats: { startXp: 0, endXp: 60, badges: [], bestStreak: 1, objectives: 1 },
    scores: {
      skills: [{ indicators: [{ band: "Strong" }, { band: "Strong" }, { band: "Weak" }] }],
      passed: false,
    },
    metrics: { openQuestions: 2 },
    ...extra,
  }) as unknown as Report;

describe("game layer from saved runs", () => {
  it("starts at zero with no runs", () => {
    expect(dayStreak([], NOW)).toBe(0);
    expect(xpToday([], NOW)).toBe(0);
    expect(weeklyQuests([], NOW).every((q) => q.progress === 0)).toBe(true);
  });

  it("counts consecutive days and keeps the streak until the day after the last run", () => {
    const runs = [run(2026, 9, 5), run(2026, 9, 6)];
    expect(dayStreak(runs, NOW)).toBe(2);
    expect(dayStreak([...runs, run(2026, 9, 7)], NOW)).toBe(3);
    expect(dayStreak([run(2026, 9, 4)], NOW)).toBe(0);
  });

  it("adds XP earned today only", () => {
    expect(xpToday([run(2026, 9, 7), run(2026, 9, 6)], NOW)).toBe(60);
  });

  it("marks this week's practice days, Monday first", () => {
    const week = weekStrip([run(2026, 9, 5), run(2026, 9, 7)], NOW);
    expect(week.map((d) => d.done)).toEqual([true, false, true, false, false, false, false]);
    expect(week.findIndex((d) => d.today)).toBe(2);
  });

  it("derives quests from behaviour and caps them at the target", () => {
    const q = weeklyQuests(
      [run(2026, 9, 6), run(2026, 9, 7, { metrics: { openQuestions: 5 } } as Partial<Report>)],
      NOW,
    );
    const by = Object.fromEntries(q.map((x) => [x.id, x.progress]));
    expect(by).toEqual({ strong: 2, open: 3, runs: 2, pass: 0 });
  });
});

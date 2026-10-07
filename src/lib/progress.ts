import type { Report } from "../domain/report";

// The AI RolePlay game layer, derived only from saved runs. Nothing here is seeded: a learner with
// no runs sees zero streak, zero XP today and quests at 0. Time comes in as an argument so the
// rules are testable; the UI passes the current date.

export const DAILY_GOAL_XP = 100;

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const xpOf = (r: Report) => Math.max(0, (r.stats?.endXp ?? 0) - (r.stats?.startXp ?? 0));

function daysPractised(runs: Report[]) {
  return new Set(runs.map((r) => dayKey(new Date(r.completedAt))));
}

// Consecutive days with at least one finished run, counted back from today. A streak survives until
// the end of the day after the last run, as in most habit apps, so it never drops while you still can
// keep it.
export function dayStreak(runs: Report[], now: Date): number {
  const days = daysPractised(runs);
  let cursor = days.has(dayKey(now)) ? now : addDays(now, -1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function xpToday(runs: Report[], now: Date): number {
  const today = dayKey(now);
  return runs.filter((r) => dayKey(new Date(r.completedAt)) === today).reduce((a, r) => a + xpOf(r), 0);
}

const startOfWeek = (now: Date) => addDays(now, -((now.getDay() + 6) % 7)); // Monday

// This week, Monday to Sunday: which days had a finished run.
export function weekStrip(runs: Report[], now: Date) {
  const days = daysPractised(runs);
  const monday = startOfWeek(now);
  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return labels.map((label, i) => {
    const d = addDays(monday, i);
    return { label, short: label[0], done: days.has(dayKey(d)), today: dayKey(d) === dayKey(now) };
  });
}

export type Quest = { id: string; label: string; progress: number; target: number };

// Weekly quests reward the behaviours the instrument scores, never length or time on task.
export function weeklyQuests(runs: Report[], now: Date): Quest[] {
  const monday = dayKey(startOfWeek(now));
  const week = runs.filter((r) => dayKey(new Date(r.completedAt)) >= monday);
  const strongInRun = (r: Report) =>
    r.scores.skills.flatMap((s) => s.indicators).filter((i) => i.band === "Strong").length;
  const best = (f: (r: Report) => number) => week.reduce((m, r) => Math.max(m, f(r)), 0);
  const quests: Quest[] = [
    { id: "strong", label: "Show 3 Strong behaviours in one run", progress: best(strongInRun), target: 3 },
    {
      id: "open",
      label: "Ask 3 open questions in one run",
      progress: best((r) => r.metrics.openQuestions),
      target: 3,
    },
    { id: "runs", label: "Finish 2 runs this week", progress: week.length, target: 2 },
    {
      id: "pass",
      label: "Reach the pass mark",
      progress: week.some((r) => r.scores.passed) ? 1 : 0,
      target: 1,
    },
  ];
  return quests.map((q) => ({ ...q, progress: Math.min(q.progress, q.target) }));
}

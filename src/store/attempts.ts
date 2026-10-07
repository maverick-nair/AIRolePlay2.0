import type { Report } from "../domain/report";
import type { Mode } from "../domain/scenario";

// Attempt persistence. localStorage stands in for the sessions backend; the shape is what the
// server will store. Assessment mode is one attempt per scenario and the lock lives here.

const KEY = "gk.roleplay.attempts.v1";

export type Attempt = Report;

function readAll(): Attempt[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attempt[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: Attempt[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage may be unavailable (private window, quota). The session still completes in memory.
  }
}

export function listAttempts(scenarioId: string, mode?: Mode): Attempt[] {
  return readAll()
    .filter((a) => a.scenarioId === scenarioId && (!mode || a.mode === mode))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export function saveAttempt(report: Report) {
  const all = readAll().filter((a) => a.id !== report.id);
  all.push(report);
  writeAll(all);
}

export function assessmentAttempt(scenarioId: string): Attempt | null {
  return listAttempts(scenarioId, "assessment")[0] ?? null;
}

export function clearAttempts(scenarioId?: string) {
  if (!scenarioId) return writeAll([]);
  writeAll(readAll().filter((a) => a.scenarioId !== scenarioId));
}

// XP actually earned across saved practice runs. This is the only source of a learner's progress
// until the backend exists; nothing is seeded, so a first time learner starts at zero.
export function careerXp(list: Attempt[]): number {
  return list.reduce((sum, a) => sum + Math.max(0, (a.stats?.endXp ?? 0) - (a.stats?.startXp ?? 0)), 0);
}

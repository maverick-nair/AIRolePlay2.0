import { describeTranscript, type DescriptiveMetrics } from "./descriptive";
import type { Band, Mode, Scenario, SessionTurn, TurnClassification } from "./scenario";
import { scoreSession, type ScoreSummary } from "./scoring";
import type { ReportNarrative, ReportRequest } from "../providers/types";

// A report is assembled from three traceable sources only: engine output (scores, evidence,
// descriptive metrics), authored scenario copy (indicator coaching) and the narrative a report
// writer produced from that same evidence. Nothing else may appear on a participant facing report.

export type SessionStats = {
  startXp: number;
  endXp: number;
  badges: string[];
  bestStreak: number;
  objectives: number;
  // Cohort rank is not tracked until a backend supplies real peers; older saved reports may carry it.
  startRank?: number;
  endRank?: number;
  // Times the participant spoke over the persona. Descriptive only, never scored.
  interruptions?: number;
};

export type Report = {
  id: string;
  scenarioId: string;
  instrumentVersion: string;
  mode: Mode;
  completedAt: string;
  durationSeconds: number;
  transcript: SessionTurn[];
  classifications: TurnClassification[];
  scores: ScoreSummary;
  metrics: DescriptiveMetrics;
  narrative: ReportNarrative;
  stats: SessionStats;
  agreement: number | null;
};

export function buildReportRequest(
  scenario: Scenario,
  transcript: SessionTurn[],
  scores: ScoreSummary,
): ReportRequest {
  return {
    scenario,
    transcript,
    overall: scores.overall,
    skills: scores.skills.map((s) => ({
      skillId: s.id,
      name: s.name,
      score: s.score,
      indicators: s.indicators.map((i) => ({
        indicatorId: i.indicatorId,
        label: i.label,
        band: i.band,
        quotes: i.evidence.map((e) => e.quote),
      })),
    })),
  };
}

export function assembleReport(input: {
  id: string;
  scenario: Scenario;
  mode: Mode;
  completedAt: string;
  durationSeconds: number;
  transcript: SessionTurn[];
  classifications: TurnClassification[];
  narrative: ReportNarrative;
  stats: SessionStats;
  agreement: number | null;
}): Report {
  const scores = scoreSession(input.scenario, input.classifications);
  return {
    id: input.id,
    scenarioId: input.scenario.id,
    instrumentVersion: input.scenario.instrument.version,
    mode: input.mode,
    completedAt: input.completedAt,
    durationSeconds: input.durationSeconds,
    transcript: input.transcript,
    classifications: input.classifications,
    scores,
    metrics: describeTranscript(input.transcript),
    narrative: input.narrative,
    stats: input.stats,
    agreement: input.agreement,
  };
}

// Transcript turns marked from the evidence, for the transcript tab and the PDF. A turn is never
// summarised by one bare label: every mark names the indicator and the band it reached, so a turn
// that holds both a strength and a gap shows both. Adequate hits are not key moments and are left out.
export type TurnMark = { indicatorId: string; label: string; band: Band };
export type TurnTag = "strength" | "gap" | "mixed";
export type TaggedTurn = SessionTurn & { tag?: TurnTag; marks: TurnMark[] };

const MARK_ORDER: Record<Band, number> = { Harmful: 0, Weak: 1, Strong: 2, Adequate: 3 };

export function tagTranscript(report: Report): TaggedTurn[] {
  const labels = new Map<string, string>();
  for (const s of report.scores.skills) for (const i of s.indicators) labels.set(i.indicatorId, i.label);
  const byTurn = new Map<number, TurnMark[]>();
  for (const c of report.classifications) {
    const marks = c.hits
      .filter((h) => h.band !== "Adequate")
      .map((h) => ({
        indicatorId: h.indicatorId,
        label: labels.get(h.indicatorId) ?? h.indicatorId,
        band: h.band,
      }))
      .sort((a, b) => MARK_ORDER[a.band] - MARK_ORDER[b.band]);
    if (marks.length) byTurn.set(c.turnIndex, [...(byTurn.get(c.turnIndex) ?? []), ...marks]);
  }
  return report.transcript.map((t, i) => {
    const marks = byTurn.get(i) ?? [];
    if (!marks.length) return { ...t, marks };
    const hasGap = marks.some((m) => m.band === "Weak" || m.band === "Harmful");
    const hasStrong = marks.some((m) => m.band === "Strong");
    const tag: TurnTag = hasGap && hasStrong ? "mixed" : hasGap ? "gap" : "strength";
    return { ...t, tag, marks };
  });
}

export const TAG_LABEL: Record<TurnTag, string> = {
  strength: "Strength",
  gap: "Missed opportunity",
  mixed: "Strength and gap",
};

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

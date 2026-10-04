import { describeTranscript, type DescriptiveMetrics } from "./descriptive";
import type { Mode, Scenario, SessionTurn, TurnClassification } from "./scenario";
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
  startRank: number;
  endRank: number;
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

// Transcript turns tagged from the evidence, for the transcript tab and the PDF.
export type TaggedTurn = SessionTurn & { tag?: "strength" | "gap" };

export function tagTranscript(report: Report): TaggedTurn[] {
  const byTurn = new Map<number, "strength" | "gap">();
  for (const c of report.classifications) {
    const hasHarm = c.hits.some((h) => h.band === "Weak" || h.band === "Harmful");
    const hasStrong = c.hits.some((h) => h.band === "Strong");
    if (hasHarm) byTurn.set(c.turnIndex, "gap");
    else if (hasStrong) byTurn.set(c.turnIndex, "strength");
  }
  return report.transcript.map((t, i) => (byTurn.has(i) ? { ...t, tag: byTurn.get(i) } : { ...t }));
}

export function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

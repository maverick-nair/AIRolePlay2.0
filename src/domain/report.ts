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

// ---------- Where the chance was ----------

export type Opportunity =
  | { kind: "moment"; incidentLabel: string; time: string; quote: string; turnIndex: number }
  | { kind: "not-reached"; incidentLabel: string }
  | { kind: "every-turn" };

// For an indicator, finds the critical incident that gave the clearest chance to show it and the
// persona line where that incident landed in this transcript. Incidents fire after the player's Nth
// turn, so the line is the first persona turn after that many live player turns. Indicators no incident
// is authored for (asking open questions, building on what was said) had a chance on every turn.
export function opportunityFor(
  scenario: Scenario,
  transcript: SessionTurn[],
  indicatorId: string,
  player = "You",
): Opportunity {
  const incident = scenario.stimulus.incidents.find((i) => i.opportunityFor.includes(indicatorId));
  if (!incident) return { kind: "every-turn" };
  // The scripted opening is not part of the live call; incidents count live player turns only.
  let playerTurns = 0;
  for (let i = scenario.stimulus.opening.length; i < transcript.length; i++) {
    const t = transcript[i];
    if (t.speaker === player) playerTurns++;
    else if (playerTurns === incident.afterPlayerTurn && playerTurns > 0 && t.text.trim())
      return { kind: "moment", incidentLabel: incident.label, time: t.time, quote: t.text, turnIndex: i };
  }
  return { kind: "not-reached", incidentLabel: incident.label };
}

// One plain sentence a report can show for an indicator that was never observed.
export function opportunityLine(o: Opportunity, personaFirstName: string): string {
  if (o.kind === "moment")
    return `The chance was at ${o.time} (${o.incidentLabel}), when ${personaFirstName} said: "${o.quote}"`;
  if (o.kind === "not-reached")
    return `The call ended before ${o.incidentLabel.toLowerCase()}, the moment built to bring this out.`;
  return "Every reply was a chance to show this. It did not appear in this call.";
}

import { useEffect, useMemo, useState } from "react";
import type { ReportTab } from "../types";
import ThemeToggle from "../components/ThemeToggle";
import TenPointScale from "../components/TenPointScale";
import ScoreRing from "../components/ScoreRing";
import RollingNumber from "../components/RollingNumber";
import ConfettiBurst from "../components/ConfettiBurst";
import FlameIcon from "../components/FlameIcon";
import BadgeMedal from "../components/BadgeMedal";
import EmailDialog from "../components/EmailDialog";
import SkillScore from "../components/SkillScore";
import SkillRadar from "../components/SkillRadar";
import BandChip, { BAND_COLORS } from "../components/BandChip";
import AttemptTrend from "../components/AttemptTrend";
import { bandFor, cefrColor } from "../lib/score";
import { readableOn } from "../lib/color";
import buildReportPdf, { pdfName } from "../lib/buildReportPdf";
import { KNOLSKAPE_BANDS } from "../data/bands";
import { BADGES } from "../data/badges";
import { PEER_THRESHOLD, PLAYERS_COMPLETED } from "../data/scenario";
import { formatDuration, tagTranscript, type Report } from "../domain/report";
import type { Band, Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";
import { formatTalkShare } from "../domain/descriptive";
import type { Product } from "../products";

const CEFR_LADDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function SummaryPage({
  product,
  report,
  scenario,
  attempts,
  runsLeft = Number.POSITIVE_INFINITY,
  onPractiseAgain,
  onHome,
}: {
  product: Product;
  report: Report;
  scenario: Scenario;
  attempts: Report[];
  runsLeft?: number;
  onPractiseAgain: () => void;
  onHome: () => void;
}) {
  const [tab, setTab] = useState<ReportTab>("overview");
  const [expanded, setExpanded] = useState<string | null>(report.scores.skills[0]?.id ?? null);
  const peersReady = PLAYERS_COMPLETED > PEER_THRESHOLD;
  const [compare, setCompare] = useState(peersReady);
  const [emailOpen, setEmailOpen] = useState(false);
  // Confetti on a passing practice run only: an assessment has no game layer.
  const [party, setParty] = useState(report.scores.passed && report.mode !== "assessment");
  useEffect(() => {
    const t = window.setTimeout(() => setParty(false), 3000);
    return () => window.clearTimeout(t);
  }, []);

  const isAssessment = report.mode === "assessment";
  const canPractiseAgain = !isAssessment && runsLeft > 0;
  const { scores, metrics, narrative, stats } = report;
  const tagged = useMemo(() => tagTranscript(report), [report]);
  const peer = scenario.instrument.peerBaseline;
  const radarSkills = scores.skills.map((s) => ({ name: s.name, score: s.score, peer: peer[s.id] ?? 0 }));
  const rung = CLAIM_LADDER[scenario.instrument.claimRung];
  const name = pdfName(report);
  const download = () => void buildReportPdf(report, scenario).then((d) => d.save(name));

  // Strengths and development priorities come straight from the evidence, most recent first.
  const allEvidence = scores.skills.flatMap((s) =>
    s.indicators.flatMap((i) =>
      i.evidence.map((e) => ({ ...e, label: i.label, skill: s.name, indicatorId: i.indicatorId })),
    ),
  );
  const uniqueBy = <T extends { indicatorId: string }>(xs: T[]) => {
    const seen = new Set<string>();
    return xs.filter((x) => (seen.has(x.indicatorId) ? false : (seen.add(x.indicatorId), true)));
  };
  const strengths = uniqueBy(allEvidence.filter((e) => e.band === "Strong")).slice(0, 3);
  const gaps = uniqueBy(allEvidence.filter((e) => e.band === "Weak" || e.band === "Harmful")).slice(0, 3);
  const unobserved = scores.skills.flatMap((s) =>
    s.indicators.filter((i) => !i.observed).map((i) => ({ label: i.label, skill: s.name })),
  );
  const development = [
    ...gaps.map((g) => ({
      title: g.label,
      detail: g.note,
      time: report.transcript[g.turnIndex]?.time ?? "",
    })),
    ...unobserved.slice(0, Math.max(0, 3 - gaps.length)).map((u) => ({
      title: u.label,
      detail: `Not observed in this conversation (${u.skill}). The scenario gave an opportunity for it.`,
      time: "",
    })),
  ];
  const sorted = [...scores.skills].sort((a, b) => b.score - a.score);
  const attemptIndex = attempts.findIndex((a) => a.id === report.id);
  const practiceScores = attempts.map((a) => a.scores.overall);
  const weakest = scores.skills.flatMap((s) => s.indicators).sort((a, b) => a.points - b.points)[0];

  const KPIS = [
    {
      label: "Talk : Listen",
      value: formatTalkShare(metrics.talkShare),
      target: "Guide 45 : 55",
      ok: metrics.talkShare <= 0.5,
    },
    {
      label: "Questions Asked",
      value: String(metrics.questions),
      target: `${metrics.openQuestions} open, ${metrics.closedQuestions} closed`,
      ok: metrics.openQuestions >= 3,
    },
    {
      label: "Offers Made",
      value: String(metrics.conditionalOffers + metrics.unconditionalOffers),
      target: `${metrics.conditionalOffers} conditional, ${metrics.unconditionalOffers} not`,
      ok: metrics.unconditionalOffers === 0,
    },
    {
      label: "Indicators Observed",
      value: `${Math.round(scores.coverage * 100)}%`,
      target: "Share of behaviours shown",
      ok: scores.coverage >= 0.6,
    },
    {
      label: "Words per Turn",
      value: String(metrics.avgWordsPerTurn),
      target: `Longest ${metrics.longestTurnWords}`,
      ok: metrics.avgWordsPerTurn <= 60,
    },
    {
      label: "Your Turns",
      value: String(metrics.playerTurns),
      target: `${formatDuration(report.durationSeconds)} on the call`,
      ok: metrics.playerTurns >= 4,
    },
  ];

  const TABS: { id: ReportTab; label: string }[] = [
    { id: "overview", label: "Performance Overview" },
    { id: "evidence", label: "Evidence by Skill" },
    { id: "comm", label: "Communication" },
    { id: "transcript", label: "Transcript" },
  ];

  const anchorFor = (indicatorId: string, band: Band | null) => {
    const ind = scenario.instrument.skills.flatMap((s) => s.indicators).find((i) => i.id === indicatorId);
    if (!ind || !band) return null;
    return ind.anchors[band.toLowerCase() as keyof typeof ind.anchors];
  };
  const coachingFor = (indicatorId: string) =>
    scenario.instrument.skills.flatMap((s) => s.indicators).find((i) => i.id === indicatorId)?.coaching;

  return (
    <div
      className="relative isolate min-h-full overflow-auto"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 50% 0%, rgb(var(--accent-rgb) / 0.14) 0%, transparent 60%)",
      }}
    >
      <div aria-hidden className="box-pattern" />
      <nav className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 md:px-8 py-3 border-b border-ink/10">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))" }}
          >
            <span className="text-white text-xs font-bold font-display">{product.mark}</span>
          </div>
          <span className="text-ink/70 font-display font-medium text-sm">{product.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            onClick={onHome}
            className="px-3 py-2 rounded-lg text-ink/85 text-xs font-semibold hover:text-ink border border-ink/15 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            {isAssessment ? "Back to assessment" : "Back to AI RolePlay"}
          </button>
          <button
            onClick={download}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-ink/85 text-xs font-semibold hover:text-ink border border-ink/15 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M7 2v7M4 6.5 7 9.5l3-3M2.5 12h9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PDF
          </button>
          <button
            onClick={() => setEmailOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-ink/85 text-xs font-semibold hover:text-ink border border-ink/15 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <rect x="1.5" y="3" width="11" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="m2 3.8 5 3.7 5-3.7"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Email
          </button>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-ink/70 text-xs uppercase tracking-widest font-medium mb-1 flex items-center gap-2">
              {isAssessment ? `${product.name} assessment report` : `${product.name} practice report`}
              <span
                className="px-1.5 py-0.5 rounded text-xs font-display font-semibold tracking-wider normal-case"
                style={
                  isAssessment
                    ? { background: "rgb(var(--accent-rgb) / 0.14)", color: "var(--brand)" }
                    : { background: "rgba(52,211,153,0.14)", color: "var(--ok)" }
                }
              >
                {isAssessment
                  ? "One attempt, standardised persona"
                  : `Attempt ${attemptIndex + 1} of ${attempts.length}`}
              </span>
            </p>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-ink tracking-tight">
              {scenario.title}
            </h1>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink/75">
              {[
                ["Report", report.id],
                [
                  "Date",
                  new Date(report.completedAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                ],
                ["Duration", formatDuration(report.durationSeconds)],
                ["Instrument", `v${report.instrumentVersion}`],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <dt className="text-ink/70">{k}</dt>
                  <dd className="font-semibold text-ink tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div
            role="radiogroup"
            aria-label="Report view"
            className="inline-flex self-start lg:self-auto p-1 rounded-xl border border-ink/15"
            style={{ background: "var(--surface)" }}
          >
            {[
              { v: true, l: "Compare with peers" },
              { v: false, l: "Just me" },
            ].map((o) => (
              <button
                key={o.l}
                role="radio"
                aria-checked={compare === o.v}
                disabled={o.v && !peersReady}
                title={
                  o.v && !peersReady
                    ? `Unlocks once more than ${PEER_THRESHOLD} people have played (${PLAYERS_COMPLETED} so far)`
                    : undefined
                }
                onClick={() => setCompare(o.v)}
                className="px-3.5 py-2 rounded-lg text-xs font-display font-semibold min-h-[36px] transition-colors disabled:cursor-not-allowed disabled:line-through focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                style={
                  compare === o.v
                    ? { background: "var(--accent)", color: "#ffffff" }
                    : { color: "rgb(var(--ink) / 0.75)" }
                }
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {/* Instrument status: shown above every tab so a score is never read without its rung */}
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 mb-5"
          style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.35)" }}
        >
          <span
            className="px-2 py-1 rounded text-xs font-display font-bold tracking-wider uppercase"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Rung {scenario.instrument.claimRung} of 4: {rung.title}
          </span>
          <p className="text-ink/80 text-xs leading-relaxed flex-1 min-w-[16rem] max-w-[85ch]">
            {rung.claim} <span className="text-ink/70">{rung.fitFor}</span>
          </p>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Report sections"
          className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl mb-5 glass"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className="tool-btn flex-1 basis-[calc(50%-0.375rem)] sm:basis-0 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs md:text-sm font-display font-semibold min-h-[44px] whitespace-nowrap"
                style={
                  active
                    ? {
                        background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
                        color: "#ffffff",
                        boxShadow: "0 6px 20px rgb(var(--accent-rgb) / 0.35)",
                      }
                    : { background: "transparent", color: "rgb(var(--ink) / 0.75)" }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ===================== OVERVIEW ===================== */}
        {tab === "overview" && (
          <div
            role="tabpanel"
            id="panel-overview"
            aria-labelledby="tab-overview"
            className="animate-fade-in-up"
          >
            <div className="grid lg:grid-cols-12 gap-4 mb-4">
              <div className="lg:col-span-8">
                <TenPointScale
                  score={scores.overall}
                  raw={scores.weightedAverage}
                  description={`Your overall effectiveness at protecting value and the relationship while negotiating a contract renewal under price pressure. ${scores.passed ? `You met the pass mark of ${scenario.passScore}.` : `The pass mark for this scenario is ${scenario.passScore}.`}`}
                />
              </div>
              <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
                {compare ? (
                  <div
                    className="rounded-2xl border border-ink/10 p-5"
                    style={{ background: "var(--surface)" }}
                  >
                    <p className="text-ink/70 text-xs font-bold tracking-widest uppercase mb-2">
                      Above Peer Average
                    </p>
                    <p className="font-display font-bold text-ink text-4xl tabular-nums">
                      {scores.skills.filter((s) => s.score > (peer[s.id] ?? 0)).length}
                      <span className="text-lg text-ink/70"> of {scores.skills.length}</span>
                    </p>
                    <p className="text-ink/75 text-xs mt-1">
                      Skills above the sample cohort average for this scenario
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl border border-ink/10 p-5"
                    style={{ background: "var(--surface)" }}
                  >
                    <p className="text-ink/70 text-xs font-bold tracking-widest uppercase mb-2">Next Band</p>
                    <p className="font-display font-bold text-ink text-4xl tabular-nums">
                      {Math.max(0, bandFor(scores.overall).max + 1 - scores.overall)}
                      <span className="text-lg text-ink/70"> pts</span>
                    </p>
                    <p className="text-ink/75 text-xs mt-1">
                      To reach{" "}
                      {
                        KNOLSKAPE_BANDS[Math.min(4, KNOLSKAPE_BANDS.indexOf(bandFor(scores.overall)) + 1)]
                          .label
                      }
                    </p>
                  </div>
                )}
                <div
                  className="rounded-2xl border border-ink/10 p-5"
                  style={{ background: "var(--surface)" }}
                >
                  <p className="text-ink/70 text-xs font-bold tracking-widest uppercase mb-2">
                    Strongest Skill
                  </p>
                  <p className="font-display font-bold text-ink text-xl leading-tight">{sorted[0].name}</p>
                  <p className="text-ink/75 text-xs mt-1">
                    {sorted[0].score}/10, your clearest advantage in this call
                  </p>
                </div>
              </div>
            </div>

            {!isAssessment && (
              <section
                className="rounded-2xl border border-ink/10 p-5 mb-4 grid md:grid-cols-12 gap-5 items-center"
                style={{ background: "var(--surface)" }}
              >
                <div className="md:col-span-4">
                  <h2 className="font-display font-semibold text-ink text-sm mb-1">
                    Progress Across Attempts
                  </h2>
                  <p className="text-ink/75 text-xs leading-relaxed">
                    {practiceScores.length > 1
                      ? `Attempt ${attemptIndex + 1} of ${practiceScores.length} on this instrument. Best so far ${Math.max(...practiceScores)}/10.`
                      : "Your first attempt. Practise again and the trend appears here."}
                  </p>
                </div>
                <div className="md:col-span-4">
                  <AttemptTrend scores={practiceScores} currentIndex={attemptIndex} />
                </div>
                <div className="md:col-span-4 flex flex-col gap-2">
                  <p className="text-ink/75 text-xs">
                    Focus next: <span className="text-ink font-semibold">{weakest?.label}</span>
                  </p>
                  {canPractiseAgain ? (
                    <button
                      onClick={onPractiseAgain}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-display font-semibold text-sm text-white min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)]"
                      style={{ background: "var(--accent)" }}
                    >
                      Practise again
                    </button>
                  ) : (
                    <p className="text-ink/75 text-xs" role="status">
                      All {scenario.maxPracticeAttempts} practice runs on this scenario are used.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Rewards earned in this call: practice only, an assessment has no game layer */}
            {!isAssessment && (
              <section
                className="rounded-2xl border p-5 mb-4 relative overflow-hidden"
                style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.35)" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                  <h2 className="font-display font-semibold text-ink text-sm">Rewards Earned</h2>
                  <p className="text-ink/75 text-xs">
                    XP and badges carry over to your profile and the season leaderboard.
                  </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-3">
                    <p className="text-ink/75 text-xs font-bold tracking-widest uppercase mb-1">XP Earned</p>
                    <p className="font-display font-bold text-4xl text-ink">
                      +<RollingNumber value={stats.endXp - stats.startXp} />
                    </p>
                    <p className="text-ink/75 text-xs mt-1">
                      Total <RollingNumber value={stats.endXp} className="font-semibold text-ink" /> XP
                    </p>
                  </div>
                  <div className="lg:col-span-2">
                    <p className="text-ink/75 text-xs font-bold tracking-widest uppercase mb-1">
                      Best Streak
                    </p>
                    <p className="font-display font-bold text-4xl text-ink flex items-center gap-1.5">
                      <span className="text-brand">
                        <FlameIcon size={26} />
                      </span>
                      {stats.bestStreak}
                    </p>
                    <p className="text-ink/75 text-xs mt-1">Strong replies in a row</p>
                  </div>
                  {compare && (
                    <div className="lg:col-span-2">
                      <p className="text-ink/75 text-xs font-bold tracking-widest uppercase mb-1">
                        Leaderboard
                      </p>
                      <p className="font-display font-bold text-4xl text-ink">#{stats.endRank}</p>
                      <p className="text-ink/75 text-xs mt-1">
                        {stats.startRank > stats.endRank
                          ? `Up ${stats.startRank - stats.endRank} from #${stats.startRank}`
                          : `Held at #${stats.startRank}`}
                        , sample cohort
                      </p>
                    </div>
                  )}
                  <div className={`col-span-2 ${compare ? "lg:col-span-5" : "lg:col-span-7"}`}>
                    <p className="text-ink/75 text-xs font-bold tracking-widest uppercase mb-2">
                      Badges{" "}
                      <span className="text-ink font-display">
                        {stats.badges.length}/{BADGES.length}
                      </span>
                    </p>
                    <ul className="flex flex-wrap gap-3">
                      {BADGES.map((b) => {
                        const got = stats.badges.includes(b.id);
                        return (
                          <li
                            key={b.id}
                            className="flex flex-col items-center w-16 text-center"
                            title={b.desc}
                          >
                            <span
                              className={got ? "shine" : ""}
                              style={{
                                clipPath: "polygon(50% 0, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
                              }}
                            >
                              <BadgeMedal mark={b.mark} earned={got} size={42} />
                            </span>
                            <span
                              className={`mt-1 text-xs leading-tight ${got ? "text-ink font-semibold" : "text-ink/70"}`}
                            >
                              {b.name}
                            </span>
                            <span className="sr-only">
                              {got ? "Earned" : "Not earned"}: {b.desc}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* Conversation metrics: descriptive, computed from the transcript */}
            <section
              className="rounded-2xl border border-ink/10 p-5 mb-4"
              style={{ background: "var(--surface)" }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="font-display font-semibold text-ink text-sm">Conversation Metrics</h2>
                <p className="text-ink/75 text-xs">
                  Descriptive, computed from your transcript. They inform the picture and never feed the
                  score.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {KPIS.map((k) => (
                  <div key={k.label} className="rounded-xl p-3.5 border border-ink/10">
                    <p className="text-ink/75 text-xs font-medium mb-1.5">{k.label}</p>
                    <p className="font-display font-bold text-ink text-xl tabular-nums">{k.value}</p>
                    <p className="text-xs mt-1 flex items-center gap-1.5 text-ink/75">
                      <span
                        aria-hidden
                        className="w-1.5 h-1.5 rounded-full flex-none"
                        style={{ background: k.ok ? "#2f7a34" : "#e07b2e" }}
                      />
                      <span className="sr-only">{k.ok ? "Within guide." : "Outside guide."}</span>
                      {k.target}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid lg:grid-cols-12 gap-4 mb-4">
              <section
                className="lg:col-span-7 rounded-2xl border border-ink/10 p-5 flex flex-col"
                style={{ background: "var(--surface)" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
                  <h2 className="font-display font-semibold text-ink text-sm">Skill Snapshot</h2>
                  <p className="text-ink/75 text-xs flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="w-3 h-2 rounded-sm bg-ink/60" />
                      Your score
                    </span>
                    {compare && (
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className="w-0.5 h-3 bg-ink" />
                        Peer average
                      </span>
                    )}
                  </p>
                </div>
                <ul className="space-y-3.5">
                  {scores.skills.map((k) => {
                    const b = bandFor(k.score);
                    return (
                      <li key={k.id} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-4">
                        <span className="text-ink text-sm font-medium leading-snug">
                          {k.name} <span className="text-ink/70 text-xs tabular-nums">({k.weight}%)</span>
                        </span>
                        <div
                          className="relative h-2.5 rounded-full"
                          style={{ background: "rgb(var(--ink) / 0.08)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${k.score * 10}%`, background: b.color }}
                          />
                          {compare && (
                            <span
                              aria-hidden
                              className="absolute -top-1 -bottom-1 w-0.5 bg-ink"
                              style={{ left: `${(peer[k.id] ?? 0) * 10}%` }}
                            />
                          )}
                        </div>
                        <span className="text-ink text-sm font-display font-semibold tabular-nums w-24 text-right">
                          {k.score}/10{" "}
                          {compare && (
                            <span className="text-ink/70 text-xs font-normal">
                              vs {(peer[k.id] ?? 0).toFixed(1)}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-5 pt-5 border-t border-ink/10 flex-1 grid sm:grid-cols-[minmax(0,15rem)_1fr] gap-6 items-center">
                  <SkillRadar skills={radarSkills} compare={compare} />
                  <dl className="grid grid-cols-2 gap-3">
                    {[
                      { k: "Highest", v: `${sorted[0].score}/10`, sub: sorted[0].name },
                      {
                        k: "Lowest",
                        v: `${sorted[sorted.length - 1].score}/10`,
                        sub: sorted[sorted.length - 1].name,
                      },
                      {
                        k: "Spread",
                        v: `${sorted[0].score - sorted[sorted.length - 1].score} pts`,
                        sub:
                          sorted[0].score - sorted[sorted.length - 1].score <= 2
                            ? "Balanced profile"
                            : "Uneven profile",
                      },
                      compare
                        ? {
                            k: "Above Peers",
                            v: `${scores.skills.filter((k) => k.score > (peer[k.id] ?? 0)).length} of ${scores.skills.length}`,
                            sub: "Skills beating the sample cohort average",
                          }
                        : {
                            k: "Proficient+",
                            v: `${scores.skills.filter((k) => k.score >= 7).length} of ${scores.skills.length}`,
                            sub: "Skills scoring 7 or higher",
                          },
                    ].map((c) => (
                      <div
                        key={c.k}
                        className="rounded-xl p-3 border border-ink/10"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <dt className="text-ink/75 text-xs font-bold tracking-widest uppercase">{c.k}</dt>
                        <dd className="font-display font-bold text-ink text-xl tabular-nums mt-1">{c.v}</dd>
                        <dd className="text-ink/75 text-xs leading-snug">{c.sub}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>

              <div className="lg:col-span-5 grid md:grid-cols-2 lg:grid-cols-1 gap-4">
                {[
                  {
                    title: "Key Strengths",
                    items: strengths.map((s) => ({
                      title: s.label,
                      detail: s.note,
                      time: report.transcript[s.turnIndex]?.time ?? "",
                    })),
                    color: "#2f7a34",
                    empty: "No indicator reached the Strong anchor in this call.",
                  },
                  {
                    title: "Development Priorities",
                    items: development,
                    color: "#b5472f",
                    empty: "Every observed indicator reached at least the Adequate anchor.",
                  },
                ].map((col) => (
                  <section
                    key={col.title}
                    className="rounded-2xl border border-ink/10 p-5"
                    style={{ background: "var(--surface)", borderTop: `3px solid ${col.color}` }}
                  >
                    <h2 className="font-display font-semibold text-ink text-sm mb-4">{col.title}</h2>
                    {col.items.length === 0 ? (
                      <p className="text-ink/75 text-sm">{col.empty}</p>
                    ) : (
                      <ol className="space-y-3">
                        {col.items.map((it, i) => (
                          <li key={`${it.title}-${i}`} className="flex gap-3">
                            <span className="font-display text-xs font-bold text-ink/70 tabular-nums mt-0.5">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="flex-1">
                              <p className="text-ink text-sm font-semibold flex items-baseline justify-between gap-3">
                                {it.title}
                                {it.time && (
                                  <span className="text-ink/70 text-xs font-normal tabular-nums">
                                    at {it.time}
                                  </span>
                                )}
                              </p>
                              <p className="text-ink/80 text-sm leading-relaxed mt-0.5">{it.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5 flex flex-col">
                <h2 className="font-display font-semibold text-ink text-sm mb-4">Overall Feedback</h2>
                <div
                  className="rounded-xl p-4 text-ink/85 text-sm leading-relaxed flex-1 space-y-4"
                  style={{ background: "rgb(var(--ink) / 0.03)", border: "1px solid rgb(var(--ink) / 0.06)" }}
                >
                  {narrative.overall.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
              <div className="glass rounded-2xl p-5 flex flex-col">
                <h2 className="font-display font-semibold text-ink text-sm mb-4">
                  Actionable Recommendations
                </h2>
                <div
                  className="rounded-xl p-4 text-ink/85 text-sm leading-relaxed flex-1"
                  style={{ background: "rgb(var(--ink) / 0.03)", border: "1px solid rgb(var(--ink) / 0.06)" }}
                >
                  <ul className="space-y-3">
                    {narrative.recommendations.map((r) => (
                      <li key={r.title} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-shrink-0" />
                        <span>
                          <strong>{r.title}:</strong> {r.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== EVIDENCE ===================== */}
        {tab === "evidence" && (
          <div
            role="tabpanel"
            id="panel-evidence"
            aria-labelledby="tab-evidence"
            className="animate-fade-in-up"
          >
            <p className="text-ink/80 text-sm mb-5 leading-relaxed">
              Each skill is scored from behavioural indicators. Every band below is tied to words you said,
              quoted with the time they were said. Indicators the conversation never showed are marked and
              count as Weak, because this scenario gave each one an opportunity to appear.
            </p>
            <div className="space-y-3">
              {scores.skills.map((s, i) => {
                const open = expanded === s.id;
                const delta = s.score - (peer[s.id] ?? 0);
                return (
                  <div key={s.id} className="glass rounded-2xl overflow-hidden">
                    <button
                      className="w-full flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-ink/[0.02] min-h-[44px]"
                      onClick={() => setExpanded(open ? null : s.id)}
                      aria-expanded={open}
                    >
                      <span className="font-display text-xs font-bold text-ink/70 tabular-nums w-6 flex-none">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-[12rem]">
                        <p className="font-display font-semibold text-ink text-sm">
                          {s.name}
                          <span className="text-ink/70 text-xs font-normal ml-2">Weight {s.weight}%</span>
                          <span className="text-ink/70 text-xs font-normal ml-2">
                            {s.observedCount}/{s.indicators.length} indicators observed
                          </span>
                        </p>
                        <p className="text-ink/75 text-xs mt-0.5 leading-relaxed max-w-[85ch]">{s.desc}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {compare && (
                          <span className="hidden md:block text-right">
                            <span className="block text-ink/70 text-xs">vs peers</span>
                            <span className="block text-ink text-xs font-semibold tabular-nums">
                              {delta >= 0 ? "+" : ""}
                              {delta.toFixed(1)}
                            </span>
                          </span>
                        )}
                        <SkillScore score={s.score} />
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{
                            transform: open ? "rotate(180deg)" : "rotate(0)",
                            transition: "transform 0.25s ease",
                            color: "rgb(var(--ink) / 0.7)",
                          }}
                          aria-hidden
                        >
                          <path
                            d="M4 6l4 4 4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </button>
                    {open && (
                      <div className="px-5 pb-5 border-t border-ink/10 pt-4 space-y-4 animate-fade-in-up">
                        {narrative.skillFeedback[s.id] && (
                          <p
                            className="text-ink/85 text-sm leading-relaxed rounded-xl p-4"
                            style={{
                              background: "rgb(var(--ink) / 0.04)",
                              border: "1px solid rgb(var(--ink) / 0.08)",
                            }}
                          >
                            {narrative.skillFeedback[s.id]}
                          </p>
                        )}
                        <div className="divide-y divide-ink/10 rounded-xl border border-ink/10">
                          {s.indicators.map((ind) => {
                            const coaching = coachingFor(ind.indicatorId);
                            const needsWork = !ind.observed || ind.band === "Weak" || ind.band === "Harmful";
                            return (
                              <div
                                key={ind.indicatorId}
                                className="px-4 py-3.5 grid lg:grid-cols-[16rem_1fr] gap-x-5 gap-y-2"
                              >
                                <div>
                                  <p className="text-ink text-sm font-medium">{ind.label}</p>
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <BandChip band={ind.band} />
                                    {ind.observed && (
                                      <span className="text-ink/70 text-xs tabular-nums">
                                        {ind.evidence.length} {ind.evidence.length === 1 ? "turn" : "turns"}
                                      </span>
                                    )}
                                  </div>
                                  {ind.band && (
                                    <p className="text-ink/70 text-xs mt-2 leading-relaxed">
                                      Anchor: {anchorFor(ind.indicatorId, ind.band)}
                                    </p>
                                  )}
                                </div>
                                <div className="space-y-2.5">
                                  {ind.evidence.map((e, k) => (
                                    <figure
                                      key={k}
                                      className="rounded-xl p-3.5 border border-ink/10"
                                      style={{ borderLeft: `3px solid ${BAND_COLORS[e.band]}` }}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-ink/75 text-xs font-semibold tabular-nums">
                                          {report.transcript[e.turnIndex]?.time}
                                        </span>
                                        <span
                                          className="text-xs font-semibold"
                                          style={{ color: BAND_COLORS[e.band] }}
                                        >
                                          {e.band}
                                        </span>
                                      </div>
                                      <blockquote className="text-ink text-sm italic leading-relaxed">
                                        "{e.quote}"
                                      </blockquote>
                                      <figcaption className="text-ink/80 text-sm mt-1 leading-relaxed">
                                        {e.note}
                                      </figcaption>
                                    </figure>
                                  ))}
                                  {!ind.observed && (
                                    <p className="text-ink/75 text-sm leading-relaxed">
                                      Not observed. Strong looks like:{" "}
                                      <span className="text-ink/85">
                                        {anchorFor(ind.indicatorId, "Strong")}
                                      </span>
                                    </p>
                                  )}
                                  {needsWork && coaching && (
                                    <div className="grid md:grid-cols-2 gap-3">
                                      <div
                                        className="rounded-xl p-3 border border-ink/10"
                                        style={{ background: "var(--surface-2)" }}
                                      >
                                        <p className="text-ink/75 text-xs font-semibold uppercase tracking-wider mb-1">
                                          Recommendation
                                        </p>
                                        <p className="text-ink/85 text-sm leading-relaxed">
                                          {coaching.recommendation}
                                        </p>
                                      </div>
                                      <div
                                        className="rounded-xl p-3 border border-ink/10"
                                        style={{ background: "var(--surface-2)" }}
                                      >
                                        <p className="text-ink/75 text-xs font-semibold uppercase tracking-wider mb-1">
                                          Practice Drill
                                        </p>
                                        <p className="text-ink/85 text-sm leading-relaxed">
                                          {coaching.drill}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== COMMUNICATION ===================== */}
        {tab === "comm" && (
          <div
            role="tabpanel"
            id="panel-comm"
            aria-labelledby="tab-comm"
            className="animate-fade-in-up grid lg:grid-cols-12 gap-4 items-start"
          >
            <div className="lg:col-span-5 space-y-4">
              <div className="glass rounded-2xl p-5">
                <h2 className="font-display font-semibold text-ink text-sm mb-1">How the Conversation Ran</h2>
                <p className="text-ink/75 text-xs mb-4">Counted from your transcript. Descriptive only.</p>
                <dl className="grid grid-cols-2 gap-3">
                  {[
                    ["Talk : Listen", formatTalkShare(metrics.talkShare)],
                    ["Questions", `${metrics.questions} (${metrics.openQuestions} open)`],
                    [
                      "Offers",
                      `${metrics.conditionalOffers} conditional, ${metrics.unconditionalOffers} not`,
                    ],
                    ["Filler words", String(metrics.fillerWords)],
                    ["Words per turn", String(metrics.avgWordsPerTurn)],
                    ["Your turns", String(metrics.playerTurns)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl p-3 border border-ink/10">
                      <dt className="text-ink/75 text-xs font-medium">{k}</dt>
                      <dd className="font-display font-bold text-ink text-lg tabular-nums mt-0.5">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {narrative.language && (
                <div className="glass rounded-2xl p-5 flex flex-col">
                  <h2 className="font-display font-semibold text-ink text-sm mb-4">Clarity</h2>
                  <div className="flex items-center gap-4 mb-3">
                    <ScoreRing
                      score={Math.round(narrative.language.clarity.score)}
                      max={10}
                      size={72}
                      level="Clarity"
                    />
                    <div>
                      <p className="font-display font-bold text-ink text-2xl">
                        {narrative.language.clarity.score.toFixed(1)}
                        <span className="text-ink/70 text-base">/10</span>
                      </p>
                      <p className="text-ink/70 text-xs">Message clarity index (descriptive)</p>
                    </div>
                  </div>
                  <p className="text-ink/70 text-xs leading-relaxed">{narrative.language.clarity.note}</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-7 space-y-4">
              {narrative.language ? (
                <>
                  <div className="glass rounded-2xl p-6">
                    <h2 className="font-display font-semibold text-ink text-sm mb-4">
                      Language Proficiency · CEFR (descriptive)
                    </h2>
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                      <div
                        className="flex flex-col items-center justify-center rounded-2xl px-8 py-5 flex-shrink-0"
                        style={{
                          background: `${cefrColor(narrative.language.cefr.overall)}18`,
                          border: `1px solid ${cefrColor(narrative.language.cefr.overall)}40`,
                        }}
                      >
                        <span
                          className="font-display font-bold text-4xl"
                          style={{ color: cefrColor(narrative.language.cefr.overall) }}
                        >
                          {narrative.language.cefr.overall}
                        </span>
                        <span className="text-ink/70 text-xs font-medium mt-1">
                          {narrative.language.cefr.band}
                        </span>
                      </div>
                      <p className="text-ink/70 text-sm leading-relaxed flex-1">
                        {narrative.language.cefr.summary}
                      </p>
                    </div>
                    <div
                      className="mt-6"
                      role="img"
                      aria-label={`CEFR level achieved: ${narrative.language.cefr.overall}`}
                    >
                      <div className="flex gap-1.5">
                        {CEFR_LADDER.map((lvl) => {
                          const reached =
                            CEFR_LADDER.indexOf(lvl) <= CEFR_LADDER.indexOf(narrative.language!.cefr.overall);
                          const isCurrent = lvl === narrative.language!.cefr.overall;
                          return (
                            <div key={lvl} className="flex-1 flex flex-col items-center gap-1.5">
                              <div
                                className="w-full h-2 rounded-full"
                                style={{ background: reached ? cefrColor(lvl) : "rgb(var(--ink) / 0.08)" }}
                              />
                              <span
                                className="text-xs font-display"
                                style={{
                                  color: isCurrent ? "rgb(var(--ink))" : "rgb(var(--ink) / 0.7)",
                                  fontWeight: isCurrent ? 700 : 500,
                                }}
                              >
                                {lvl}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-6 grid sm:grid-cols-2 gap-3">
                      {narrative.language.cefr.dimensions.map((d) => (
                        <div
                          key={d.name}
                          className="rounded-xl p-3.5"
                          style={{
                            background: "rgb(var(--ink) / 0.03)",
                            border: "1px solid rgb(var(--ink) / 0.06)",
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-ink/75 text-xs font-semibold font-display">{d.name}</span>
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-bold font-display"
                              style={{
                                background: cefrColor(d.level),
                                color: readableOn(cefrColor(d.level)),
                              }}
                            >
                              {d.level}
                            </span>
                          </div>
                          <p className="text-ink/70 text-xs leading-relaxed">{d.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="glass rounded-2xl p-5">
                      <h2 className="font-display font-semibold text-ink text-sm mb-4">Sentiment</h2>
                      <div
                        className="h-3 rounded-full overflow-hidden flex mb-4"
                        role="img"
                        aria-label={narrative.language.sentiment
                          .map((s) => `${s.label} ${s.pct}%`)
                          .join(", ")}
                      >
                        {narrative.language.sentiment.map((s, i) => (
                          <div
                            key={s.label}
                            style={{
                              width: `${s.pct}%`,
                              background: ["#10b981", "#f59e0b", "#f43f5e"][i % 3],
                            }}
                          />
                        ))}
                      </div>
                      <div className="space-y-2">
                        {narrative.language.sentiment.map((s, i) => (
                          <div key={s.label} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2 text-ink/70">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ background: ["#10b981", "#f59e0b", "#f43f5e"][i % 3] }}
                                aria-hidden
                              />
                              {s.label}
                            </span>
                            <span className="font-display font-semibold text-ink tabular-nums">{s.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="glass rounded-2xl p-5">
                      <h2 className="font-display font-semibold text-ink text-sm mb-4">Tone</h2>
                      <div className="space-y-3">
                        {narrative.language.tone.map((t) => (
                          <div key={t.label} className="flex items-center gap-3">
                            <span className="text-ink/70 text-xs font-medium w-28 flex-shrink-0">
                              {t.label}
                            </span>
                            <div
                              className="flex-1 h-2 rounded-full"
                              style={{ background: "rgb(var(--ink) / 0.07)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${t.pct}%`,
                                  background: "linear-gradient(90deg,var(--accent),var(--accent-2))",
                                }}
                              />
                            </div>
                            <span className="text-ink text-xs font-semibold font-display tabular-nums w-9 text-right">
                              {t.pct}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="glass rounded-2xl p-6">
                  <h2 className="font-display font-semibold text-ink text-sm mb-2">Language Analysis</h2>
                  <p className="text-ink/80 text-sm leading-relaxed">
                    CEFR level, sentiment, tone and clarity are produced by the AI report writer from your own
                    turns. This report was produced with the offline template writer, so they are not shown.
                    Nothing here is ever estimated without the evidence to support it.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TRANSCRIPT ===================== */}
        {tab === "transcript" && (
          <div
            role="tabpanel"
            id="panel-transcript"
            aria-labelledby="tab-transcript"
            className="animate-fade-in-up grid lg:grid-cols-12 gap-4 items-start"
          >
            <aside className="lg:col-span-4 lg:order-2 lg:sticky lg:top-4 glass rounded-2xl p-5">
              <h2 className="font-display font-semibold text-ink text-sm mb-3">Key Moments</h2>
              {tagged.filter((l) => l.tag).length === 0 ? (
                <p className="text-ink/75 text-sm">
                  No turn in this call reached a Strong, Weak or Harmful band.
                </p>
              ) : (
                <ol className="space-y-2.5">
                  {tagged
                    .filter((l) => l.tag)
                    .map((l, i) => (
                      <li key={`${l.time}-${i}`} className="flex gap-3 text-sm">
                        <span className="text-ink/75 text-xs tabular-nums w-10 flex-none pt-0.5">
                          {l.time}
                        </span>
                        <span className="flex-1">
                          <span
                            className="block text-xs font-semibold"
                            style={{ color: l.tag === "strength" ? "var(--ok)" : "var(--danger)" }}
                          >
                            {l.tag === "strength" ? "Strength" : "Missed opportunity"}
                          </span>
                          <span className="text-ink/85 leading-snug">{l.text}</span>
                        </span>
                      </li>
                    ))}
                </ol>
              )}
            </aside>
            <div className="glass rounded-2xl p-6 lg:col-span-8 lg:order-1">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-ink text-xl">Conversation Transcript</h2>
                <span
                  className="px-3 py-1 rounded-full text-ink/70 text-xs font-medium"
                  style={{ background: "rgb(var(--ink) / 0.05)" }}
                >
                  {tagged.length} turns · {formatDuration(report.durationSeconds)}
                </span>
              </div>
              <div className="space-y-6">
                {tagged.map((t, i) => {
                  const you = t.speaker === "You";
                  return (
                    <div key={i} className={`flex flex-col gap-1.5 ${you ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-ink/80 text-xs font-bold font-display">{t.speaker}</span>
                        <span className="text-ink/70 text-xs tabular-nums">{t.time}</span>
                        {t.tag && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              background: t.tag === "strength" ? "#2f7a34" : "#b5472f",
                              color: "#ffffff",
                            }}
                          >
                            {t.tag === "strength" ? "Strength" : "Missed opportunity"}
                          </span>
                        )}
                      </div>
                      <div
                        className="max-w-[85%] px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed"
                        style={
                          you
                            ? {
                                background: "rgb(var(--accent-rgb) / 0.12)",
                                color: "rgb(var(--ink) / 0.9)",
                                border: "1px solid rgb(var(--accent-rgb) / 0.25)",
                              }
                            : {
                                background: "rgb(var(--ink) / 0.04)",
                                color: "rgb(var(--ink) / 0.75)",
                                border: "1px solid rgb(var(--ink) / 0.08)",
                              }
                        }
                      >
                        {t.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button
            onClick={download}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold text-sm text-white min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)]"
            style={{
              background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
              boxShadow: "0 8px 30px rgb(var(--accent-rgb) / 0.3)",
            }}
          >
            Download Report
          </button>
          <button
            onClick={() => setEmailOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold text-sm text-ink border border-ink/20 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            Email Report
          </button>
          {canPractiseAgain && (
            <button
              onClick={onPractiseAgain}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-semibold text-sm text-ink border border-ink/20 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              Practise again
            </button>
          )}
        </div>
        {isAssessment && (
          <p className="text-center text-ink/70 text-xs mt-4">
            This assessment allowed one attempt. The report is saved and cannot be retaken.
          </p>
        )}
      </main>
      {party && <ConfettiBurst pieces={120} />}
      {emailOpen && (
        <EmailDialog
          report={report}
          scenario={scenario}
          pdfName={name}
          onClose={() => setEmailOpen(false)}
          onDownload={download}
        />
      )}
    </div>
  );
}

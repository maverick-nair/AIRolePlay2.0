import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportTab } from "../types";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import Tabs from "../components/Tabs";
import TenPointScale from "../components/TenPointScale";
import ScoreRing from "../components/ScoreRing";
import RollingNumber from "../components/RollingNumber";
import ConfettiBurst from "../components/ConfettiBurst";
import FlameIcon from "../components/FlameIcon";
import BadgeMedal from "../components/BadgeMedal";
import EmailDialog from "../components/EmailDialog";
import SkillScore from "../components/SkillScore";
import BandChip, { BAND_COLORS } from "../components/BandChip";
import MarkList from "../components/MarkList";
import AttemptTrend from "../components/AttemptTrend";
import { bandFor, cefrColor } from "../lib/score";
import { readableOn } from "../lib/color";
import buildReportPdf, { pdfName } from "../lib/buildReportPdf";
import { BADGES } from "../data/badges";
import { SAMPLE_COHORT } from "../data/peers";
import { PEER_THRESHOLD, PLAYERS_COMPLETED } from "../data/scenario";
import {
  formatDuration,
  opportunityFor,
  opportunityLine,
  TAG_LABEL,
  tagTranscript,
  type Report,
} from "../domain/report";
import type { Band, Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";
import { formatTalkShare } from "../domain/descriptive";
import type { Product } from "../products";

const CEFR_LADDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SEVERITY: Record<Band, number> = { Harmful: 0, Weak: 1, Adequate: 2, Strong: 3 };

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
  const isAssessment = report.mode === "assessment";
  const [tab, setTab] = useState<ReportTab>("overview");
  const [expanded, setExpanded] = useState<string | null>(report.scores.skills[0]?.id ?? null);
  // Peer comparison is a practice aid. Conversation AI shows no peer toggle and no cohort.
  const peersReady = !isAssessment && PLAYERS_COMPLETED > PEER_THRESHOLD;
  const [compare, setCompare] = useState(peersReady);
  const [emailOpen, setEmailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showCohort, setShowCohort] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const [party, setParty] = useState(!isAssessment && report.scores.passed);
  useEffect(() => {
    const t = window.setTimeout(() => setParty(false), 3000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!shareOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        setShareOpen(false);
        shareRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        return;
      }
      if (!shareRef.current?.contains(e.target as Node)) setShareOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [shareOpen]);

  const canPractiseAgain = !isAssessment && runsLeft > 0;
  const { scores, metrics, narrative, stats } = report;
  const tagged = useMemo(() => tagTranscript(report), [report]);
  const peer = scenario.instrument.peerBaseline;
  const rung = CLAIM_LADDER[scenario.instrument.claimRung];
  // Rung 1 instruments are structured feedback only: never a basis for talent decisions.
  const feedbackOnly = scenario.instrument.claimRung === 1;
  const personaFirst = scenario.stimulus.persona.name.split(" ")[0];
  const name = pdfName(report);
  const download = () => void buildReportPdf(report, scenario).then((d) => d.save(name));

  const indicatorById = new Map(
    scenario.instrument.skills.flatMap((s) => s.indicators.map((i) => [i.id, i] as const)),
  );
  const strongAnchor = (id: string) => indicatorById.get(id)?.anchors.strong ?? "";
  const anchorFor = (indicatorId: string, band: Band | null) => {
    const ind = indicatorById.get(indicatorId);
    if (!ind || !band) return null;
    return ind.anchors[band.toLowerCase() as keyof typeof ind.anchors];
  };
  const coachingFor = (indicatorId: string) => indicatorById.get(indicatorId)?.coaching;

  // Every observed behaviour, with the words that showed it.
  const allEvidence = scores.skills.flatMap((s) =>
    s.indicators.flatMap((i) =>
      i.evidence.map((e) => ({ ...e, label: i.label, skill: s.name, indicatorId: i.indicatorId })),
    ),
  );
  const uniqueBy = <T extends { indicatorId: string }>(xs: T[]) => {
    const seen = new Set<string>();
    return xs.filter((x) => (seen.has(x.indicatorId) ? false : (seen.add(x.indicatorId), true)));
  };
  const timeOf = (turnIndex: number) => report.transcript[turnIndex]?.time ?? "";
  const gapEvidence = uniqueBy(
    allEvidence
      .filter((e) => e.band === "Weak" || e.band === "Harmful")
      .sort((a, b) => SEVERITY[a.band] - SEVERITY[b.band] || a.turnIndex - b.turnIndex),
  );
  const strongEvidence = uniqueBy(allEvidence.filter((e) => e.band === "Strong"));
  const unobserved = scores.skills.flatMap((s) =>
    s.indicators
      .filter((i) => !i.observed)
      .map((i) => ({
        indicatorId: i.indicatorId,
        label: i.label,
        opportunity: opportunityFor(scenario, report.transcript, i.indicatorId),
      })),
  );

  // Your next move: one behaviour. The most serious gap in your own words first, then a behaviour
  // the call gave a clear moment for that never showed, then the weakest Adequate one.
  type Focus = {
    indicatorId: string;
    label: string;
    what: string;
    quote?: string;
    time?: string;
    band: Band | null;
  };
  const focus: Focus | null = (() => {
    const g = gapEvidence[0];
    if (g)
      return {
        indicatorId: g.indicatorId,
        label: g.label,
        what: g.note,
        quote: g.quote,
        time: timeOf(g.turnIndex),
        band: g.band,
      };
    const missed = unobserved.find((u) => u.opportunity.kind === "moment") ?? unobserved[0];
    if (missed)
      return {
        indicatorId: missed.indicatorId,
        label: missed.label,
        what: opportunityLine(missed.opportunity, personaFirst),
        band: null,
      };
    const adequate = uniqueBy(allEvidence.filter((e) => e.band === "Adequate"))[0];
    if (adequate)
      return {
        indicatorId: adequate.indicatorId,
        label: adequate.label,
        what: adequate.note,
        quote: adequate.quote,
        time: timeOf(adequate.turnIndex),
        band: "Adequate",
      };
    return null;
  })();

  // Three key moments: gaps and strengths in your own words, in the order they happened.
  const moments = (() => {
    const gaps = gapEvidence.filter((g) => g.indicatorId !== focus?.indicatorId);
    const queue: typeof allEvidence = [];
    for (let i = 0; i < Math.max(gaps.length, strongEvidence.length); i++) {
      if (strongEvidence[i]) queue.push(strongEvidence[i]);
      if (gaps[i]) queue.push(gaps[i]);
    }
    // Prefer different turns, so two cards never quote the same line; fill from repeats if needed.
    const turns = new Set<number>();
    const picked = queue.filter((e) => (turns.has(e.turnIndex) ? false : (turns.add(e.turnIndex), true)));
    for (const e of queue) if (picked.length < 3 && !picked.includes(e)) picked.push(e);
    return picked.slice(0, 3).sort((a, b) => a.turnIndex - b.turnIndex);
  })();

  const attemptIndex = attempts.findIndex((a) => a.id === report.id);
  const practiceScores = attempts.map((a) => a.scores.overall);
  const firstScore = practiceScores[0] ?? scores.overall;
  const bestScore = practiceScores.length ? Math.max(...practiceScores) : scores.overall;
  const cohort = [
    ...SAMPLE_COHORT.map((p) => ({ ...p, you: false })),
    { name: "You", first: firstScore, best: bestScore, you: true },
  ].sort((a, b) => b.best - b.first - (a.best - a.first) || b.best - a.best);

  const TABS: { id: ReportTab; label: string }[] = [
    { id: "overview", label: "Performance Overview" },
    { id: "evidence", label: "Evidence by Skill" },
    { id: "comm", label: "Communication" },
    { id: "transcript", label: "Transcript" },
  ];

  const card = "card p-5";
  const eyebrow = "text-ink/80 text-[13px] font-semibold";

  return (
    <AppShell
      product={product}
      items={[
        {
          id: "home",
          label: isAssessment ? "Back to assessment" : "Back to AI RolePlay",
          icon: isAssessment ? "brief" : "home",
          onSelect: onHome,
        },
        { id: "report", label: "This report", icon: "report", current: true, onSelect: () => {} },
      ]}
    >
      <main className="max-w-[1480px] p-3 sm:p-4 lg:p-5 flex flex-col gap-4 animate-fade-in-up">
        {/* Header card: which report, its terms, and what you can do with it */}
        <section className="card p-5 sm:p-6" aria-labelledby="report-title">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="min-w-0">
              <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink/80">
                  <li>
                    <button onClick={onHome} className="underline underline-offset-4 min-h-6">
                      {isAssessment ? "Assessment" : "Practice"}
                    </button>
                  </li>
                  <li aria-hidden>/</li>
                  <li aria-current="page" className="text-ink font-medium">
                    {isAssessment ? `${product.name} assessment report` : `${product.name} practice report`}
                  </li>
                </ol>
              </nav>
              <h1
                id="report-title"
                className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-ink leading-tight"
              >
                {scenario.title}
              </h1>
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink/80">
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
                    <dt>{k}</dt>
                    <dd className="font-semibold text-ink tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="chip">
                  {isAssessment
                    ? "One attempt, standardised persona"
                    : `Run ${attemptIndex + 1} of ${scenario.maxPracticeAttempts}`}
                </span>
                {isAssessment && feedbackOnly && (
                  <span className="chip chip-neutral">Pilot assessment, feedback only</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end flex-none">
              {!isAssessment && (
                <div role="radiogroup" aria-label="Report view" className="seg">
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
                      className="px-3 min-h-10 rounded-[var(--radius-sm)] text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:line-through"
                      style={
                        compare === o.v
                          ? {
                              background: "var(--surface)",
                              color: "rgb(var(--ink))",
                              fontWeight: 600,
                              boxShadow: "0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 1px var(--edge)",
                            }
                          : { color: "rgb(var(--ink) / 0.8)" }
                      }
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              )}
              {/* Share: one menu for the PDF and the email */}
              <div ref={shareRef} className="relative">
                <button
                  onClick={() => setShareOpen((v) => !v)}
                  aria-expanded={shareOpen}
                  aria-controls="share-menu"
                  className="btn btn-secondary"
                >
                  <Icon name="share" size={17} />
                  Share
                </button>
                {shareOpen && (
                  <ul
                    id="share-menu"
                    className="card absolute right-0 top-full mt-1.5 z-30 w-52 p-1.5 shadow-xl"
                  >
                    {[
                      { label: "Download PDF", run: download },
                      { label: "Email report", run: () => setEmailOpen(true) },
                    ].map((o) => (
                      <li key={o.label}>
                        <button
                          onClick={() => {
                            setShareOpen(false);
                            o.run();
                          }}
                          className="w-full text-left px-3 rounded-[var(--radius-sm)] text-sm text-ink hover:bg-[var(--surface-2)] min-h-11"
                        >
                          {o.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Instrument status: shown above every tab so a score is never read without its rung */}
        <div
          className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
          style={{ borderColor: "var(--accent-ui)" }}
        >
          <span className="chip font-semibold">
            Rung {scenario.instrument.claimRung} of 4: {rung.title}
          </span>
          <p className="text-ink/85 text-sm leading-relaxed flex-1 min-w-[16rem]">
            {rung.claim} <span className="text-ink/80">{rung.fitFor}</span>
          </p>
        </div>

        <Tabs
          label="Report sections"
          idPrefix="report"
          tabs={TABS}
          value={tab}
          onChange={setTab}
          className="flex-wrap"
        />

        {/* ===================== OVERVIEW ===================== */}
        {tab === "overview" && (
          <div
            role="tabpanel"
            id="report-panel-overview"
            aria-labelledby="report-tab-overview"
            tabIndex={0}
            className="animate-fade-in-up space-y-4"
          >
            {/* AI RolePlay: a run complete moment, like finishing a lesson */}
            {!isAssessment && (
              <section
                aria-labelledby="complete-heading"
                className="rounded-2xl border-2 p-5 md:p-6 flex flex-wrap items-center gap-x-6 gap-y-4"
                style={{
                  background: scores.passed ? "var(--ok-tint)" : "var(--surface)",
                  borderColor: scores.passed
                    ? "color-mix(in srgb, var(--ok) 40%, transparent)"
                    : "var(--edge)",
                }}
              >
                <span
                  aria-hidden
                  className="w-16 h-16 flex-none rounded-full flex items-center justify-center"
                  style={{
                    background: scores.passed ? "var(--ok)" : "var(--accent)",
                    color: "var(--surface)",
                    boxShadow: `0 4px 0 ${scores.passed ? "color-mix(in srgb, var(--ok) 70%, black)" : "var(--accent-press)"}`,
                  }}
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="flex-1 min-w-[14rem]">
                  <p className={eyebrow}>
                    Run {attemptIndex + 1} of {scenario.maxPracticeAttempts}
                  </p>
                  <h2
                    id="complete-heading"
                    className="font-display font-bold text-ink text-2xl md:text-3xl mt-0.5"
                  >
                    {scores.passed ? "Run complete. You met the pass mark." : "Run complete."}
                  </h2>
                  <p className="text-ink/80 text-sm mt-1">
                    {scores.passed
                      ? "Keep the moves that worked and try a harder persona next run."
                      : `You scored ${scores.overall} against a pass mark of ${scenario.passScore}. Your next move is below.`}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2" aria-label="This run">
                  {[
                    `+${Math.max(0, stats.endXp - stats.startXp)} XP`,
                    `Best streak ${stats.bestStreak}`,
                    `${stats.objectives} of ${scenario.instrument.objectives.length} objectives`,
                  ].map((t) => (
                    <li
                      key={t}
                      className="px-3 py-1.5 rounded-full text-sm font-semibold text-ink border-2 tabular-nums"
                      style={{ background: "var(--surface)", borderColor: "var(--edge)" }}
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Conversation AI: the result in one sentence, before anything else */}
            {isAssessment && (
              <section
                aria-labelledby="result-heading"
                className="rounded-2xl border-2 p-5 md:p-6"
                style={{
                  background: "var(--surface)",
                  borderColor: scores.passed ? "var(--ok)" : "var(--danger)",
                }}
              >
                <p className={eyebrow}>Result</p>
                <h2
                  id="result-heading"
                  className="font-display font-semibold text-ink text-2xl md:text-3xl mt-1"
                >
                  {scores.passed ? "Met the pass mark." : "Below the pass mark."}{" "}
                  <span className="text-ink/85">
                    {scores.overall} of {scenario.passScore} required.
                  </span>
                </h2>
                <p className="text-ink/80 text-sm mt-2 leading-relaxed max-w-3xl">
                  {scores.skills.filter((s) => s.score >= scenario.passScore).length} of{" "}
                  {scores.skills.length} skills reached the pass mark on their own.{" "}
                  {feedbackOnly
                    ? "This is a pilot assessment: the result is feedback for you, not a basis for talent decisions."
                    : rung.fitFor}
                </p>
              </section>
            )}

            <div className="grid lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6">
                <TenPointScale
                  score={scores.overall}
                  raw={scores.weightedAverage}
                  description={`Your overall effectiveness at protecting value and the relationship while negotiating a contract renewal under price pressure. The pass mark for this scenario is ${scenario.passScore}.`}
                />
              </div>

              {isAssessment ? (
                <section
                  aria-labelledby="next-heading"
                  className={`lg:col-span-6 ${card}`}
                  style={{ background: "var(--surface)" }}
                >
                  <h2 id="next-heading" className="font-display font-semibold text-ink text-lg mb-3">
                    What happens next
                  </h2>
                  <ol className="space-y-3 text-sm text-ink/85 leading-relaxed">
                    {[
                      "Your report is saved. This assessment allowed one attempt, so it cannot be retaken.",
                      feedbackOnly
                        ? "As a pilot, the result is shared with you as feedback. It is not used for selection, promotion or performance ratings."
                        : rung.fitFor,
                      "Before you discuss the result, open the Evidence tab: every rating quotes the words it was based on.",
                      "If something went wrong during the call, such as audio failing, tell your administrator.",
                    ].map((t, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="font-display text-xs font-bold text-ink/75 tabular-nums mt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                  {focus && (
                    <div className="mt-4 pt-4 border-t border-ink/10">
                      <p className={eyebrow}>Where to focus</p>
                      <p className="text-ink font-semibold mt-1">{focus.label}</p>
                      <p className="text-ink/80 text-sm mt-1 leading-relaxed">
                        Strong looks like: {strongAnchor(focus.indicatorId)}
                      </p>
                    </div>
                  )}
                </section>
              ) : (
                <section
                  aria-labelledby="next-heading"
                  className="lg:col-span-6 rounded-2xl border-2 p-5 md:p-6 flex flex-col"
                  style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.55)" }}
                >
                  <p className={eyebrow}>Your next move</p>
                  {focus ? (
                    <>
                      <h2
                        id="next-heading"
                        className="font-display font-semibold text-ink text-xl md:text-2xl mt-1"
                      >
                        {focus.label}
                      </h2>
                      <div className="mt-3 flex items-center gap-2 text-xs text-ink/75">
                        <BandChip band={focus.band} />
                        {focus.time && <span className="tabular-nums">at {focus.time}</span>}
                      </div>
                      {focus.quote && (
                        <blockquote className="mt-2 text-ink text-sm italic leading-relaxed">
                          "{focus.quote}"
                        </blockquote>
                      )}
                      <p className="text-ink/80 text-sm mt-1 leading-relaxed">{focus.what}</p>
                      <div
                        className="mt-4 rounded-xl p-3.5"
                        style={{ background: "rgb(var(--accent-rgb) / 0.1)" }}
                      >
                        <p className={eyebrow}>Try this next run</p>
                        <p className="text-ink text-sm mt-1 leading-relaxed">
                          {coachingFor(focus.indicatorId)?.recommendation}
                        </p>
                        <p className="text-ink/80 text-xs mt-2 leading-relaxed">
                          Strong looks like: {strongAnchor(focus.indicatorId)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <h2 id="next-heading" className="font-display font-semibold text-ink text-xl mt-1">
                      Every behaviour reached Strong. Try a harder persona next run.
                    </h2>
                  )}
                  <div className="mt-auto pt-4 flex flex-wrap items-center gap-3">
                    {canPractiseAgain ? (
                      <button
                        onClick={onPractiseAgain}
                        className="btn btn-primary font-display focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)]"
                      >
                        Practise again
                      </button>
                    ) : (
                      <p className="text-ink/75 text-sm" role="status">
                        All {scenario.maxPracticeAttempts} practice runs on this scenario are used.
                      </p>
                    )}
                    {canPractiseAgain && Number.isFinite(runsLeft) && (
                      <span className="text-ink/75 text-xs">
                        {runsLeft} of {scenario.maxPracticeAttempts} runs left
                      </span>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Key moments: what happened, in your words, and what the stronger version looks like */}
            <section aria-labelledby="moments-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 id="moments-heading" className="font-display font-semibold text-ink text-lg">
                  Key moments
                </h2>
                <button
                  onClick={() => setTab("transcript")}
                  className="text-sm font-semibold text-brand underline-offset-4 hover:underline min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                >
                  Read the full transcript
                </button>
              </div>
              {moments.length === 0 ? (
                <p className={`${card} text-ink/80 text-sm`} style={{ background: "var(--surface)" }}>
                  No turn in this call reached a Strong, Weak or Harmful band.
                </p>
              ) : (
                <ol className="grid md:grid-cols-3 gap-4">
                  {moments.map((m) => (
                    <li
                      key={`${m.indicatorId}-${m.turnIndex}`}
                      className={`${card} flex flex-col`}
                      style={{ background: "var(--surface)", borderTop: `3px solid ${BAND_COLORS[m.band]}` }}
                    >
                      <div className="flex items-center gap-2 text-xs text-ink/75">
                        <span className="tabular-nums font-semibold">{timeOf(m.turnIndex)}</span>
                        <BandChip band={m.band} />
                      </div>
                      <p className="text-ink font-semibold text-sm mt-2">{m.label}</p>
                      <blockquote className="text-ink/90 text-sm italic leading-relaxed mt-1.5">
                        "{m.quote}"
                      </blockquote>
                      <p className="text-ink/80 text-sm leading-relaxed mt-2 pt-2 border-t border-ink/10">
                        {m.band === "Strong" ? m.note : `Stronger: ${strongAnchor(m.indicatorId)}`}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <div className="grid lg:grid-cols-12 gap-4">
              <section
                aria-labelledby="skills-heading"
                className={`lg:col-span-7 ${card}`}
                style={{ background: "var(--surface)" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
                  <h2 id="skills-heading" className="font-display font-semibold text-ink text-lg">
                    Skills
                  </h2>
                  <p className="text-ink/75 text-xs flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="w-3 h-2 rounded-sm bg-ink/60" />
                      Your score
                    </span>
                    {compare && (
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className="w-0.5 h-3 bg-ink" />
                        Sample cohort average
                      </span>
                    )}
                  </p>
                </div>
                <ul className="space-y-3.5">
                  {scores.skills.map((k) => {
                    const b = bandFor(k.score);
                    return (
                      <li
                        key={k.id}
                        className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-x-4 gap-y-1.5"
                      >
                        <span className="text-ink text-sm font-medium truncate" title={k.name}>
                          {k.name} <span className="text-ink/75 text-xs tabular-nums">({k.weight}%)</span>
                        </span>
                        <div
                          className="relative h-2.5 rounded-full col-span-2 sm:col-span-1 order-last sm:order-none"
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
                            <span className="text-ink/75 text-xs font-normal">
                              vs {(peer[k.id] ?? 0).toFixed(1)}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {unobserved.length > 0 && (
                  <p className="text-ink/75 text-xs mt-5 pt-4 border-t border-ink/10 leading-relaxed">
                    {unobserved.length} of {scores.skills.reduce((n, s) => n + s.indicators.length, 0)}{" "}
                    behaviours never showed and count as Weak. The Evidence tab names the moment each one had.
                  </p>
                )}
              </section>

              <section
                aria-labelledby="feedback-heading"
                className={`lg:col-span-5 ${card}`}
                style={{ background: "var(--surface)" }}
              >
                <h2 id="feedback-heading" className="font-display font-semibold text-ink text-lg mb-3">
                  Overall feedback
                </h2>
                <div className="text-ink/85 text-sm leading-relaxed space-y-3">
                  {narrative.overall.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </section>
            </div>

            {/* Practice only: runs, rewards and an opt in cohort. Assessment carries no game layer. */}
            {!isAssessment && (
              <section
                aria-labelledby="runs-heading"
                className="rounded-2xl border p-5"
                style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.35)" }}
              >
                <h2 id="runs-heading" className="font-display font-semibold text-ink text-lg mb-4">
                  Your runs and rewards
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-12 gap-5 items-start">
                  <div className="col-span-2 lg:col-span-4">
                    <p className={`${eyebrow} mb-1`}>Score by run</p>
                    <AttemptTrend scores={practiceScores} currentIndex={attemptIndex} />
                    <p className="text-ink/75 text-xs mt-1">
                      {practiceScores.length > 1
                        ? `Best so far ${bestScore}/10, first run ${firstScore}/10.`
                        : "Your first run sets your baseline."}
                    </p>
                  </div>
                  <div className="lg:col-span-2">
                    <p className={`${eyebrow} mb-1`}>XP earned</p>
                    <p className="font-display font-bold text-4xl text-ink">
                      +<RollingNumber value={stats.endXp - stats.startXp} />
                    </p>
                    <p className="text-ink/75 text-xs mt-1">
                      Total <RollingNumber value={stats.endXp} className="font-semibold text-ink" /> XP
                    </p>
                  </div>
                  <div className="lg:col-span-2">
                    <p className={`${eyebrow} mb-1`}>Best streak</p>
                    <p className="font-display font-bold text-4xl text-ink flex items-center gap-1.5">
                      <span className="text-brand">
                        <FlameIcon size={26} />
                      </span>
                      {stats.bestStreak}
                    </p>
                    <p className="text-ink/75 text-xs mt-1">Strong replies in a row</p>
                  </div>
                  <div className="col-span-2 lg:col-span-4">
                    <p className={`${eyebrow} mb-2`}>
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
                              className={`mt-1 text-xs leading-tight ${got ? "text-ink font-semibold" : "text-ink/75"}`}
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

                <div className="mt-5 pt-4 border-t border-ink/10">
                  <button
                    onClick={() => setShowCohort((v) => !v)}
                    aria-expanded={showCohort}
                    aria-controls="cohort"
                    className="text-sm font-semibold text-brand min-h-[36px] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  >
                    {showCohort ? "Hide the comparison" : "See how your improvement compares"}
                  </button>
                  {showCohort && (
                    <div id="cohort" className="mt-3 max-w-xl">
                      <p className="text-ink/75 text-xs mb-2">
                        Sample cohort, for illustration until real cohort data is connected. Ranked by points
                        gained from first run to best run, not by raw score.
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-ink/75 text-xs">
                            <th scope="col" className="py-1.5 font-semibold">
                              #
                            </th>
                            <th scope="col" className="py-1.5 font-semibold">
                              Name
                            </th>
                            <th scope="col" className="py-1.5 font-semibold text-right">
                              First
                            </th>
                            <th scope="col" className="py-1.5 font-semibold text-right">
                              Best
                            </th>
                            <th scope="col" className="py-1.5 font-semibold text-right">
                              Gained
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cohort.map((p, i) => (
                            <tr
                              key={p.name}
                              className={`border-t border-ink/10 tabular-nums ${p.you ? "font-semibold text-ink" : "text-ink/85"}`}
                              style={p.you ? { background: "rgb(var(--accent-rgb) / 0.1)" } : undefined}
                            >
                              <td className="py-1.5 pl-1">{i + 1}</td>
                              <td className="py-1.5">{p.name}</td>
                              <td className="py-1.5 text-right">{p.first}</td>
                              <td className="py-1.5 text-right">{p.best}</td>
                              <td className="py-1.5 text-right pr-1">
                                {p.best - p.first > 0 ? "+" : ""}
                                {p.best - p.first}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ===================== EVIDENCE ===================== */}
        {tab === "evidence" && (
          <div
            role="tabpanel"
            id="report-panel-evidence"
            aria-labelledby="report-tab-evidence"
            tabIndex={0}
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
                      className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ink/[0.02] min-h-[44px]"
                      onClick={() => setExpanded(open ? null : s.id)}
                      aria-expanded={open}
                    >
                      <span className="font-display text-xs font-bold text-ink/70 tabular-nums w-6 flex-none">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-ink text-sm">
                          {s.name}
                          <span className="text-ink/70 text-xs font-normal ml-2">Weight {s.weight}%</span>
                          <span className="text-ink/70 text-xs font-normal ml-2">
                            {s.observedCount}/{s.indicators.length} indicators observed
                          </span>
                        </p>
                        <p className="text-ink/75 text-xs mt-0.5 leading-relaxed line-clamp-1">{s.desc}</p>
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
                                        <BandChip band={e.band} />
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
                                    <div className="space-y-1.5">
                                      <p className="text-ink/85 text-sm leading-relaxed">
                                        Not observed.{" "}
                                        {opportunityLine(
                                          opportunityFor(scenario, report.transcript, ind.indicatorId),
                                          personaFirst,
                                        )}
                                      </p>
                                      <p className="text-ink/80 text-sm leading-relaxed">
                                        Strong looks like: {anchorFor(ind.indicatorId, "Strong")}
                                      </p>
                                    </div>
                                  )}
                                  {needsWork && coaching && (
                                    <div className={`grid gap-3 ${isAssessment ? "" : "md:grid-cols-2"}`}>
                                      <div
                                        className="rounded-xl p-3 border border-ink/10"
                                        style={{ background: "var(--surface-2)" }}
                                      >
                                        <p className="text-ink/80 text-[13px] font-semibold mb-1">
                                          Recommendation
                                        </p>
                                        <p className="text-ink/85 text-sm leading-relaxed">
                                          {coaching.recommendation}
                                        </p>
                                      </div>
                                      {!isAssessment && (
                                        <div
                                          className="rounded-xl p-3 border border-ink/10"
                                          style={{ background: "var(--surface-2)" }}
                                        >
                                          <p className="text-ink/80 text-[13px] font-semibold mb-1">
                                            Practice Drill
                                          </p>
                                          <p className="text-ink/85 text-sm leading-relaxed">
                                            {coaching.drill}
                                          </p>
                                        </div>
                                      )}
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
            id="report-panel-comm"
            aria-labelledby="report-tab-comm"
            tabIndex={0}
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
                    [
                      `Times you spoke over ${personaFirst}`,
                      stats.interruptions === undefined ? "Not recorded" : String(stats.interruptions),
                    ],
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
            id="report-panel-transcript"
            aria-labelledby="report-tab-transcript"
            tabIndex={0}
            className="animate-fade-in-up grid lg:grid-cols-12 gap-4 items-start"
          >
            <aside className="lg:col-span-4 lg:order-2 lg:sticky lg:top-4 glass rounded-2xl p-5">
              <h2 className="font-display font-semibold text-ink text-sm mb-3">Key moments</h2>
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
                        <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <span
                            className="block text-xs font-semibold"
                            style={{
                              color:
                                l.tag === "strength"
                                  ? "var(--ok)"
                                  : l.tag === "gap"
                                    ? "var(--danger)"
                                    : "rgb(var(--ink) / 0.85)",
                            }}
                          >
                            {l.tag && TAG_LABEL[l.tag]}
                          </span>
                          <span className="text-ink/85 leading-snug line-clamp-2">{l.text}</span>
                          <MarkList marks={l.marks} />
                        </span>
                      </li>
                    ))}
                </ol>
              )}
            </aside>
            <div className="glass rounded-2xl p-6 lg:col-span-8 lg:order-1">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-ink text-xl">Conversation transcript</h2>
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
                      </div>
                      <MarkList marks={t.marks} align={you ? "end" : "start"} />
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

        {canPractiseAgain && tab !== "overview" && (
          <div className="flex justify-center mt-6">
            <button
              onClick={onPractiseAgain}
              className="btn btn-primary font-display px-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)]"
            >
              Practise again
            </button>
          </div>
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
    </AppShell>
  );
}

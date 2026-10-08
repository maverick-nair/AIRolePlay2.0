import { useEffect, useRef, useState } from "react";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import RollingNumber from "../components/RollingNumber";
import ConfettiBurst from "../components/ConfettiBurst";
import FlameIcon from "../components/FlameIcon";
import EmailDialog from "../components/EmailDialog";
import { BAND_COLORS } from "../components/BandChip";
import { bandFor } from "../lib/score";
import { readableOn } from "../lib/color";
import buildReportPdf, { pdfName } from "../lib/buildReportPdf";
import { BADGES } from "../data/badges";
import { SAMPLE_COHORT } from "../data/peers";
import { PEER_THRESHOLD, PLAYERS_COMPLETED } from "../data/scenario";
import { formatDuration, opportunityFor, opportunityLine, type Report } from "../domain/report";
import type { Band, Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";
import { formatTalkShare } from "../domain/descriptive";
import type { Product } from "../products";

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
  // Peer comparison is a practice aid. Conversation AI shows no peer toggle and no cohort.
  const peersReady = !isAssessment && PLAYERS_COMPLETED > PEER_THRESHOLD;
  const [compare, setCompare] = useState(peersReady);
  const [emailOpen, setEmailOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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

  const attemptIndex = attempts.findIndex((a) => a.id === report.id);
  const practiceScores = attempts.map((a) => a.scores.overall);
  const firstScore = practiceScores[0] ?? scores.overall;
  const bestScore = practiceScores.length ? Math.max(...practiceScores) : scores.overall;
  const cohort = [
    ...SAMPLE_COHORT.map((p) => ({ ...p, you: false })),
    { name: "You", first: firstScore, best: bestScore, you: true },
  ].sort((a, b) => b.best - b.first - (a.best - a.first) || b.best - a.best);

  const myRank = cohort.findIndex((p) => p.you) + 1;
  const passMark = scenario.passScore;
  const overallBand = bandFor(scores.overall);
  const shortOpportunity = (indicatorId: string) => {
    const o = opportunityFor(scenario, report.transcript, indicatorId);
    if (o.kind === "moment") return `moment ${o.time}`;
    if (o.kind === "not-reached") return "moment not reached";
    return "any reply";
  };
  const metricRows: [string, string][] = [
    ["Talk : listen", formatTalkShare(metrics.talkShare)],
    ["Questions", `${metrics.questions} (${metrics.openQuestions} open)`],
    ["Offers", `${metrics.conditionalOffers} conditional, ${metrics.unconditionalOffers} not`],
    ["Your turns", String(metrics.playerTurns)],
    ["Words per turn", String(metrics.avgWordsPerTurn)],
    ["Filler words", String(metrics.fillerWords)],
    [
      `Spoke over ${personaFirst}`,
      stats.interruptions === undefined ? "Not recorded" : String(stats.interruptions),
    ],
  ];
  const h2 = "text-[15px] font-semibold text-ink leading-tight";

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
      <div className="md:h-full flex flex-col gap-2.5 p-2.5 lg:gap-3 lg:p-3 lg:short:gap-2.5 lg:short:p-2.5">
        {/* Header strip: which report, its facts, and what you can do next */}
        <header className="card flex-none flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
          <div className="min-w-0 mr-auto">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 t-small text-ink/80">
                <li>
                  <button onClick={onHome} className="underline underline-offset-4 min-h-6">
                    {isAssessment ? "Assessment" : "Practice"}
                  </button>
                </li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-ink font-medium">
                  {isAssessment
                    ? `${product.name} assessment report, one attempt`
                    : `${product.name} practice report, run ${attemptIndex + 1} of ${scenario.maxPracticeAttempts}`}
                </li>
                {isAssessment && feedbackOnly && (
                  <li>
                    <span className="chip chip-neutral !min-h-0 py-0.5">Pilot assessment, feedback only</span>
                  </li>
                )}
              </ol>
            </nav>
            <h1
              id="report-title"
              className="text-lg xl:text-xl font-bold tracking-tight text-ink leading-tight"
            >
              {scenario.title}
            </h1>
            <dl className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 t-small text-ink/80">
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
                <div key={k} className="flex gap-1">
                  <dt>{k}</dt>
                  <dd className="font-semibold text-ink tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {!isAssessment && (
            <dl className="flex items-center gap-4" aria-label="This run">
              <div>
                <dt className="t-small text-ink/80">XP earned</dt>
                <dd className="text-base font-bold text-ink tabular-nums leading-tight">
                  +<RollingNumber value={stats.endXp - stats.startXp} />
                </dd>
              </div>
              <div>
                <dt className="t-small text-ink/80">Best streak</dt>
                <dd className="text-base font-bold text-ink leading-tight flex items-center gap-1">
                  <span className="text-brand">
                    <FlameIcon size={14} />
                  </span>
                  {stats.bestStreak}
                </dd>
              </div>
              <div>
                <dt className="t-small text-ink/80">Objectives</dt>
                <dd className="text-base font-bold text-ink tabular-nums leading-tight">
                  {stats.objectives}/{scenario.instrument.objectives.length}
                </dd>
              </div>
            </dl>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {/* Share: one menu for the PDF and the email */}
            <div ref={shareRef} className="relative" data-eval-action-menu>
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
            {!isAssessment &&
              (canPractiseAgain ? (
                <button onClick={onPractiseAgain} className="btn btn-primary">
                  Practise again
                </button>
              ) : (
                <span className="t-small text-ink/80" role="status">
                  All {scenario.maxPracticeAttempts} runs used
                </span>
              ))}
          </div>
        </header>

        <main className="dense flex-1 min-h-0 flex flex-col gap-2.5 lg:gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2.35fr)_minmax(0,1fr)]">
          {/* Result and the next move */}
          <div className="flex-none flex flex-col gap-2.5 lg:gap-3 md:grid md:grid-cols-2 lg:flex">
            <section className="card p-3 lg:p-4 lg:short:p-3" aria-labelledby="result-heading">
              <h2 id="result-heading" className={h2}>
                {isAssessment
                  ? scores.passed
                    ? "Result: met the pass mark"
                    : "Result: below the pass mark"
                  : scores.passed
                    ? "Run complete. You met the pass mark."
                    : "Run complete"}
              </h2>
              <div className="mt-1.5 flex items-center gap-3">
                <p className="flex items-baseline gap-1 leading-none">
                  <span className="text-4xl font-bold text-ink tabular-nums">{scores.overall}</span>
                  <span className="text-lg text-ink/80">/10</span>
                </p>
                <div>
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: overallBand.color, color: readableOn(overallBand.color) }}
                  >
                    {overallBand.label}
                  </span>
                  <p className="t-small text-ink/80 mt-0.5 tabular-nums">
                    Pass mark {passMark}. Weighted average {scores.weightedAverage.toFixed(2)}.
                  </p>
                </div>
              </div>
              <div
                className="relative mt-2 h-2 rounded-full"
                style={{ background: "var(--edge)" }}
                role="img"
                aria-label={`Score ${scores.overall} out of 10, pass mark ${passMark}`}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${scores.overall * 10}%`, background: overallBand.color }}
                />
                <span
                  aria-hidden
                  className="absolute -top-1 -bottom-1 w-0.5"
                  style={{ left: `${passMark * 10}%`, background: "rgb(var(--ink))" }}
                />
              </div>
              {!isAssessment && (
                <p className="mt-2 t-small text-ink/85">
                  Badges this run:{" "}
                  {stats.badges.length
                    ? stats.badges.map((id) => BADGES.find((b) => b.id === id)?.name ?? id).join(", ")
                    : "none yet"}
                  .{" "}
                  {practiceScores.length > 1
                    ? `Runs so far ${practiceScores.join(", ")}, best ${bestScore}/10.`
                    : "This first run sets your baseline."}{" "}
                  Total {stats.endXp} XP. Sample cohort rank {myRank} of {cohort.length} on points gained.
                </p>
              )}
              {isAssessment && (
                <p className="mt-2 t-small text-ink/85">
                  {scores.skills.filter((s) => s.score >= passMark).length} of {scores.skills.length} skills
                  reached the pass mark on their own.
                </p>
              )}
              <p className="mt-2 t-small text-ink/85">
                <span className="font-semibold text-[var(--accent-soft-ink)]">
                  Rung {scenario.instrument.claimRung} of 4, {rung.title.toLowerCase()}.
                </span>{" "}
                {rung.claim} {rung.fitFor}
              </p>
            </section>

            {isAssessment ? (
              <section className="card p-3 lg:p-4 lg:short:p-3" aria-labelledby="next-heading">
                <h2 id="next-heading" className={h2}>
                  What happens next
                </h2>
                <ol className="mt-1.5 flex flex-col gap-1 t-small text-ink/90">
                  {[
                    "Your report is saved. This assessment allowed one attempt, so it cannot be retaken.",
                    feedbackOnly
                      ? "As a pilot, the result is feedback for you. It is not used for selection, promotion or performance ratings."
                      : rung.fitFor,
                    "Every rating on this page shows the words it was based on. Read them before you discuss the result.",
                    "If something went wrong during the call, such as audio failing, tell your administrator.",
                  ].map((t, i) => (
                    <li key={i} className="grid grid-cols-[1.5rem_1fr]">
                      <span className="text-ink/80 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
                {focus && (
                  <p className="mt-2 t-small text-ink/85">
                    <span className="font-semibold text-ink">Where to focus: {focus.label}.</span> Strong
                    looks like: {strongAnchor(focus.indicatorId)}
                  </p>
                )}
              </section>
            ) : (
              <section
                className="card p-3 lg:p-4 lg:short:p-3"
                style={{ borderColor: "var(--accent-ui)" }}
                aria-labelledby="next-heading"
              >
                <h2 id="next-heading" className="t-small font-semibold text-ink/80">
                  Your next move
                </h2>
                {focus ? (
                  <>
                    <p className="text-base font-bold text-ink leading-tight mt-0.5">{focus.label}</p>
                    <p className="t-small text-ink/80 mt-0.5">
                      {focus.band ? focus.band : "Not observed"}
                      {focus.time ? ` at ${focus.time}` : ""}
                    </p>
                    {focus.quote && (
                      <blockquote className="mt-1 t-small italic text-ink">"{focus.quote}"</blockquote>
                    )}
                    <p className="mt-1 t-small text-ink/85">{focus.what}</p>
                    <p
                      className="mt-2 t-small px-2.5 py-2 rounded-[var(--radius-sm)]"
                      style={{ background: "var(--accent-soft)" }}
                    >
                      <span className="font-semibold text-[var(--accent-soft-ink)]">Try this next run: </span>
                      <span className="text-ink">{coachingFor(focus.indicatorId)?.recommendation}</span>
                    </p>
                    <p className="mt-1.5 t-small text-ink/85">
                      Strong looks like: {strongAnchor(focus.indicatorId)}
                    </p>
                  </>
                ) : (
                  <p className="text-base font-bold text-ink mt-0.5">
                    Every behaviour reached Strong. Try a harder persona next run.
                  </p>
                )}
              </section>
            )}
          </div>

          {/* Evidence: every skill and every behaviour, with the words and time it came from */}
          <section className="card flex-none p-3 lg:p-4" aria-labelledby="skills-heading">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id="skills-heading" className={h2}>
                Evidence by skill
              </h2>
              {!isAssessment && (
                <div role="radiogroup" aria-label="Compare with" className="seg">
                  {[
                    { v: true, l: "Peers" },
                    { v: false, l: "Just me" },
                  ].map((o) => (
                    <button
                      key={o.l}
                      role="radio"
                      aria-checked={compare === o.v}
                      disabled={o.v && !peersReady}
                      onClick={() => setCompare(o.v)}
                      className="px-2.5 min-h-8 rounded-[var(--radius-sm)] t-small font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:line-through"
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
              <p className="t-small text-ink/80">
                Each band quotes your words; unseen behaviours count as Weak.
                {compare && " Ticks mark the sample cohort average."} The PDF adds the transcript and
                coaching.
              </p>
            </div>
            <div className="mt-1.5 gap-x-4 md:columns-2 xl:columns-3 [&>section]:pb-2 [&>section]:break-inside-avoid">
              {scores.skills.map((k) => {
                const b = bandFor(k.score);
                return (
                  <section key={k.id} aria-label={k.name}>
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="t-body font-semibold text-ink leading-tight">
                        {k.name} <span className="t-small font-normal text-ink/80">({k.weight}%)</span>
                      </h3>
                      <p className="t-body font-semibold text-ink tabular-nums whitespace-nowrap">
                        {k.score}/10
                        {compare && (
                          <span className="t-small font-normal text-ink/80">
                            {" "}
                            vs {(peer[k.id] ?? 0).toFixed(1)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div
                      className="relative mt-1 h-1.5 rounded-full"
                      style={{ background: "var(--edge)" }}
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${k.score * 10}%`, background: b.color }}
                      />
                      {compare && (
                        <span
                          className="absolute -top-1 -bottom-1 w-0.5"
                          style={{ left: `${(peer[k.id] ?? 0) * 10}%`, background: "rgb(var(--ink))" }}
                        />
                      )}
                    </div>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {k.indicators.map((ind) => (
                        <li key={ind.indicatorId} className="t-small">
                          <p className="flex items-start gap-1.5">
                            <span
                              aria-hidden
                              className="mt-[0.45em] w-2 h-2 rounded-full flex-none"
                              style={
                                ind.band
                                  ? { background: BAND_COLORS[ind.band] }
                                  : { border: "1.5px solid var(--line)" }
                              }
                            />
                            <span>
                              <span className="text-ink">{ind.label}</span>
                              <span className="text-ink/80">
                                {ind.band
                                  ? `: ${ind.band}.`
                                  : `: not observed (${shortOpportunity(ind.indicatorId)}).`}
                              </span>
                              {ind.evidence.map((e, j) => (
                                <span key={j} className="text-ink/90">
                                  {" "}
                                  <span className="tabular-nums text-ink/80">{timeOf(e.turnIndex)}</span>{" "}
                                  <q className="italic">{e.quote}</q>
                                </span>
                              ))}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </section>

          {/* This run and how the conversation ran */}
          <div className="flex-none flex flex-col gap-2.5 lg:gap-3 md:grid md:grid-cols-2 lg:flex">
            <section className="card p-3 lg:p-4 lg:short:p-3" aria-labelledby="comm-heading">
              <h2 id="comm-heading" className={h2}>
                How the conversation ran
              </h2>
              <p className="t-small text-ink/80">Counted from your transcript. Descriptive, never scored.</p>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {metricRows.map(([k, v]) => (
                  <div key={k} className="t-small leading-tight">
                    <dt className="text-ink/80">{k}</dt>
                    <dd className="font-semibold text-ink tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {narrative.language && (
                <p className="mt-2 t-small text-ink/85">
                  Language: CEFR {narrative.language.cefr.overall} ({narrative.language.cefr.band}), clarity{" "}
                  {narrative.language.clarity.score.toFixed(1)}/10. Descriptive only.
                </p>
              )}
            </section>
            <section
              className="card p-3 lg:p-4 lg:short:p-3 md:col-span-2 lg:col-span-1"
              aria-labelledby="feedback-heading"
            >
              <h2 id="feedback-heading" className={h2}>
                Overall feedback
              </h2>
              <div className="mt-1 flex flex-col gap-1.5 t-small text-ink/90">
                {narrative.overall.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
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

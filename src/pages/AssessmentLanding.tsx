import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { PORTRAIT_SRC } from "../data/scenario";
import type { Report } from "../domain/report";
import type { Scenario } from "../domain/scenario";
import type { Product } from "../products";
import BuildStamp from "../components/BuildStamp";

// Conversation AI landing: an assessment brief laid out like a paper. One continuous sheet of
// numbered sections on the left, a candidate card with the confirmation and Begin on the right.
// No gamification, no difficulty choice, no hints, no indicators before the conversation.
export default function AssessmentLanding({
  product,
  scenario,
  completed,
  onBegin,
  onViewReport,
}: {
  product: Product;
  scenario: Scenario;
  completed: Report | null;
  onBegin: () => void;
  onViewReport: (report: Report) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const minutes = Math.round(scenario.durationSeconds / 60);
  const persona = scenario.stimulus.persona;
  const indicatorCount = scenario.instrument.skills.reduce((a, s) => a + s.indicators.length, 0);

  const RULES = [
    ["One attempt", "The conversation runs once. There is no rewind, no retry and no second sitting."],
    [
      `${minutes} minutes`,
      "The call ends when the time runs out and the report is produced from what was said.",
    ],
    [
      "Standardised persona",
      `${persona.name} follows the same schedule of critical incidents for every participant.`,
    ],
    [
      "Hidden criteria",
      `${indicatorCount} behavioural indicators are scored. Their anchors are shown only in the report, beside your words.`,
    ],
    [
      "Evidence, not impressions",
      "Every rating quotes the turn it comes from. Conversation metrics are descriptive and never enter the score.",
    ],
    [
      "Text only scoring",
      "If you speak, only the transcript is assessed. Nothing is inferred from voice or face.",
    ],
  ];

  const META: [string, string][] = [
    ["Instrument", `v${scenario.version}`],
    ["Attempts", "1"],
    ["Time limit", `${minutes} min`],
    ["Skills", String(scenario.instrument.skills.length)],
    ["Pass mark", `${scenario.passScore}/10`],
  ];

  const Rule = () => <hr className="border-0 border-t border-ink/15 my-8" />;
  const Heading = ({ n, children }: { n: string; children: string }) => (
    <h2 className="flex items-baseline gap-4 mb-4">
      <span className="text-xs font-semibold tracking-[0.2em] text-brand tabular-nums">{n}</span>
      <span className="font-display font-semibold text-ink text-2xl tracking-tight">{children}</span>
    </h2>
  );

  return (
    <div className="relative isolate min-h-full overflow-auto" style={{ background: "transparent" }}>
      <div aria-hidden className="box-pattern" />

      {/* Product bar */}
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-10 h-14 border-b border-ink/15"
        style={{ background: "color-mix(in srgb, var(--bg) 92%, transparent)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <span className="text-white text-xs font-bold leading-none">{product.mark}</span>
          </div>
          <span className="text-ink font-display font-semibold text-lg tracking-tight">{product.name}</span>
          <span className="hidden sm:inline text-ink/70 text-[11px] uppercase tracking-widest border-l border-ink/15 pl-3">
            {product.line}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 text-[11px] uppercase tracking-wider border"
            style={{ borderColor: "rgb(var(--accent-rgb) / 0.5)", color: "var(--brand)" }}
          >
            Assessment
          </span>
          <ThemeToggle />
        </div>
      </nav>

      {/* Brief header: eyebrow, serif title, meta strip */}
      <header className="max-w-6xl mx-auto px-6 md:px-10 pt-12 md:pt-16 pb-8 animate-fade-in-up">
        <p className="text-xs font-semibold tracking-[0.2em] text-brand mb-4 uppercase">
          Assessment brief · {scenario.category}
        </p>
        <h1 className="font-display font-semibold text-4xl md:text-6xl text-ink tracking-tight leading-[1.02] mb-6 max-w-4xl">
          {scenario.title}
        </h1>
        <p className="text-ink/75 text-base leading-relaxed max-w-3xl mb-8">
          {product.tagline} You will hold one conversation with {persona.name}, {persona.role} at{" "}
          {persona.organisation}. Your words are scored against {scenario.instrument.skills.length} skills,
          and the report shows the evidence behind every rating.
        </p>
        <dl className="flex flex-wrap border-y border-ink/20 py-4 gap-x-10 gap-y-4">
          {META.map(([k, v]) => (
            <div key={k}>
              <dt className="text-ink/70 text-[11px] uppercase tracking-widest mb-1">{k}</dt>
              <dd className="font-display font-semibold text-ink text-lg tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-10 pb-16 grid lg:grid-cols-12 gap-8 items-start animate-fade-in-up">
        {/* The paper */}
        <article
          className="lg:col-span-8 border border-ink/15 px-7 md:px-10 py-8"
          style={{ background: "var(--surface)" }}
        >
          <Heading n="01">Your role</Heading>
          <p className="text-ink/80 text-[15px] leading-relaxed">{scenario.stimulus.player.role}</p>
          <Rule />
          <Heading n="02">Your goal</Heading>
          <p className="text-ink/80 text-[15px] leading-relaxed">{scenario.stimulus.player.goal}</p>
          <Rule />
          <Heading n="03">The situation</Heading>
          <p className="text-ink/80 text-[15px] leading-relaxed">{scenario.stimulus.player.scene}</p>
          <Rule />
          <Heading n="04">Skills assessed</Heading>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-ink/70 text-[11px] uppercase tracking-widest">
                <th scope="col" className="font-semibold py-2 pr-3 border-b border-ink/20 w-8">
                  #
                </th>
                <th scope="col" className="font-semibold py-2 pr-3 border-b border-ink/20">
                  Skill
                </th>
                <th
                  scope="col"
                  className="font-semibold py-2 pr-3 border-b border-ink/20 hidden sm:table-cell"
                >
                  What it covers
                </th>
                <th scope="col" className="font-semibold py-2 border-b border-ink/20 text-right w-20">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {scenario.instrument.skills.map((sk, i) => (
                <tr key={sk.id} className="align-top">
                  <td className="py-3 pr-3 border-b border-ink/10 text-brand text-xs font-semibold tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </td>
                  <td className="py-3 pr-3 border-b border-ink/10">
                    <span className="block font-display font-semibold text-ink text-base">{sk.name}</span>
                    <span className="block sm:hidden text-ink/75 text-xs leading-relaxed mt-1">
                      {sk.desc}
                    </span>
                  </td>
                  <td className="py-3 pr-3 border-b border-ink/10 text-ink/75 text-sm leading-relaxed hidden sm:table-cell">
                    {sk.desc}
                  </td>
                  <td className="py-3 border-b border-ink/10 text-right font-display font-semibold text-ink text-base tabular-nums">
                    {sk.weight}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-ink/70 text-xs mt-4 leading-relaxed">
            The behavioural indicators under each skill are not shown before the conversation, so every
            participant meets the same unprompted challenge. The report lists them with their anchors and your
            quoted words.
          </p>
          <Rule />
          <Heading n="05">How this assessment runs</Heading>
          <ol className="space-y-4">
            {RULES.map(([k, v], i) => (
              <li key={k} className="grid grid-cols-[2rem_1fr] sm:grid-cols-[2rem_11rem_1fr] gap-x-3 gap-y-1">
                <span className="text-ink/60 text-xs tabular-nums pt-0.5">{i + 1}.</span>
                <span className="font-display font-semibold text-ink text-base">{k}</span>
                <span className="text-ink/80 text-sm leading-relaxed col-start-2 sm:col-start-3">{v}</span>
              </li>
            ))}
          </ol>
        </article>

        {/* Candidate card */}
        <aside className="lg:col-span-4 lg:sticky lg:top-20 space-y-4">
          <div className="border border-ink/15" style={{ background: "var(--surface)" }}>
            <figure className="relative aspect-[5/4] overflow-hidden border-b border-ink/15">
              <img
                src={PORTRAIT_SRC}
                alt={persona.portraitAlt}
                className="portrait-img w-full h-full object-cover object-top"
              />
            </figure>
            <div className="p-5">
              <p className="text-ink/70 text-[11px] uppercase tracking-widest mb-1">Your counterpart</p>
              <p className="font-display font-semibold text-ink text-xl">{persona.name}</p>
              <p className="text-ink/75 text-sm">
                {persona.role}, {persona.organisation}
              </p>
            </div>
          </div>

          <section
            className="border p-5"
            style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.6)" }}
          >
            {completed ? (
              <>
                <h2 className="font-display font-semibold text-ink text-xl mb-2">Assessment complete</h2>
                <p className="text-ink/80 text-sm leading-relaxed mb-4">
                  Taken on{" "}
                  {new Date(completed.completedAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  . Score{" "}
                  <span className="font-display font-semibold text-ink">{completed.scores.overall}/10</span>.
                  The one attempt has been used; the report is saved under {completed.id}.
                </p>
                <button
                  onClick={() => onViewReport(completed)}
                  className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 font-semibold text-white text-sm tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                  style={{ background: "var(--accent)" }}
                >
                  Open the report
                </button>
              </>
            ) : (
              <>
                <h2 className="font-display font-semibold text-ink text-xl mb-3">Before you begin</h2>
                <label className="flex items-start gap-3 text-sm text-ink/85 cursor-pointer mb-5">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  />
                  <span>
                    I understand this is a single, timed attempt with a standardised persona, that my
                    transcript is scored against hidden criteria, and that the report will be saved.
                  </span>
                </label>
                <button
                  onClick={onBegin}
                  disabled={!confirmed}
                  className="w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 font-semibold text-white text-sm tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed"
                  style={{ background: confirmed ? "var(--accent)" : "rgb(var(--ink) / 0.35)" }}
                >
                  Begin the assessment
                </button>
                <p className="text-ink/70 text-xs mt-3 leading-relaxed">
                  {minutes} minutes, one sitting. Find a quiet place and allow the full time.
                </p>
              </>
            )}
          </section>
        </aside>
      </div>
      <BuildStamp product={product.name} />
    </div>
  );
}

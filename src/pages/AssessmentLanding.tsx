import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import SectionLabel from "../components/SectionLabel";
import ClaimLadderPanel from "../components/ClaimLadderPanel";
import { PORTRAIT_SRC } from "../data/scenario";
import type { Report } from "../domain/report";
import type { Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";
import type { Product } from "../products";

// Conversation AI landing: the assessment product. No gamification, no difficulty choice, no hints.
// The participant reads the brief and the rules, confirms them, and takes the one attempt.
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
  const rung = CLAIM_LADDER[scenario.instrument.claimRung];
  const minutes = Math.round(scenario.durationSeconds / 60);
  const persona = scenario.stimulus.persona;
  const indicatorCount = scenario.instrument.skills.reduce((a, s) => a + s.indicators.length, 0);

  const RULES = [
    {
      k: "One attempt",
      v: "The conversation runs once. There is no rewind, no retry and no second sitting.",
    },
    {
      k: `${minutes} minutes`,
      v: "The call ends when the time runs out and the report is produced from what was said.",
    },
    {
      k: "Standardised persona",
      v: `${persona.name} follows the same schedule of critical incidents for every participant.`,
    },
    {
      k: "Hidden criteria",
      v: `${indicatorCount} behavioural indicators are scored. Their anchors are shown only in the report, beside your words.`,
    },
    {
      k: "Evidence, not impressions",
      v: "Every rating quotes the turn it comes from. Conversation metrics are descriptive and never enter the score.",
    },
    {
      k: "Text only scoring",
      v: "If you speak, only the transcript is assessed. Nothing is inferred from voice or face.",
    },
  ];

  return (
    <div className="relative isolate min-h-full overflow-auto" style={{ background: "transparent" }}>
      <div aria-hidden className="box-pattern" />
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-10 h-16 border-b border-ink/10"
        style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <span className="text-white text-xs font-bold font-display leading-none">{product.mark}</span>
          </div>
          <span className="text-ink font-display font-semibold text-base tracking-tight">{product.name}</span>
          <span className="hidden sm:inline text-ink/70 text-[11px] font-display uppercase tracking-widest border-l border-ink/15 pl-3">
            {product.line}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 text-[11px] font-display uppercase tracking-wider"
            style={{ background: "rgb(var(--accent-rgb) / 0.14)", color: "var(--brand)" }}
          >
            Assessment
          </span>
          <ThemeToggle />
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 md:px-10 pt-16 md:pt-20 pb-12 animate-fade-in-up">
        <div className="grid md:grid-cols-12 gap-10 items-start">
          <div className="md:col-span-8">
            <p className="font-display text-xs font-semibold tracking-[0.2em] text-brand mb-4">
              {scenario.category.toUpperCase()} · ASSESSMENT
            </p>
            <h1 className="font-display font-bold text-4xl md:text-5xl text-ink tracking-tight leading-[1.05] mb-5">
              {scenario.title}
            </h1>
            <p className="text-ink/75 text-sm leading-relaxed max-w-2xl mb-6">
              {product.tagline} You will hold one conversation with {persona.name}, {persona.role} at{" "}
              {persona.organisation}. Your words are scored against {scenario.instrument.skills.length} skills
              by the method described below, and the report shows the evidence behind every rating.
            </p>
            <dl
              className="grid grid-cols-2 sm:grid-cols-4 border border-ink/15"
              style={{ background: "var(--surface)" }}
            >
              {[
                ["Attempts", "1"],
                ["Time limit", `${minutes} min`],
                ["Skills", String(scenario.instrument.skills.length)],
                ["Pass mark", `${scenario.passScore}/10`],
              ].map(([k, v], i) => (
                <div
                  key={k}
                  className={`p-4 ${i ? "border-l border-ink/10" : ""} ${i >= 2 ? "max-sm:border-t max-sm:border-l-0" : ""}`}
                >
                  <dt className="text-ink/75 text-[11px] font-display uppercase tracking-widest mb-1">{k}</dt>
                  <dd className="font-display font-bold text-ink text-lg tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="md:col-span-4">
            <figure
              className="relative aspect-[4/5] w-full overflow-hidden border border-ink/10"
              style={{ background: "var(--surface-2)" }}
            >
              <img
                src={PORTRAIT_SRC}
                alt={persona.portraitAlt}
                className="w-full h-full object-cover"
                style={{ filter: "grayscale(0.4) contrast(1.05)" }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, color-mix(in srgb, var(--bg) 92%, transparent) 0%, color-mix(in srgb, var(--bg) 70%, transparent) 30%, transparent 55%)",
                }}
              />
              <figcaption className="absolute bottom-0 left-0 right-0 p-4">
                <p className="font-display font-semibold text-ink text-sm">{persona.name}</p>
                <p className="text-ink/80 text-xs mt-0.5">
                  {persona.role}, {persona.organisation}
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 md:px-10 pb-16 space-y-6 animate-fade-in-up">
        {/* Brief */}
        <div
          className="grid md:grid-cols-3 border border-ink/10"
          style={{ background: "rgb(var(--ink) / 0.08)", gap: 1 }}
        >
          <section className="p-7" style={{ background: "var(--surface)" }}>
            <SectionLabel index="01">Your Role</SectionLabel>
            <p className="text-ink/80 text-sm leading-relaxed">{scenario.stimulus.player.role}</p>
          </section>
          <section className="p-7" style={{ background: "var(--surface)" }}>
            <SectionLabel index="02">Your Goal</SectionLabel>
            <p className="text-ink/80 text-sm leading-relaxed">{scenario.stimulus.player.goal}</p>
          </section>
          <section className="p-7" style={{ background: "var(--surface)" }}>
            <SectionLabel index="03">The Situation</SectionLabel>
            <p className="text-ink/80 text-sm leading-relaxed">{scenario.stimulus.player.scene}</p>
          </section>
        </div>

        <div className="grid md:grid-cols-12 gap-6">
          {/* Skills assessed: names and descriptions only. Indicators and anchors stay hidden until the report. */}
          <section
            className="md:col-span-7 border border-ink/10 p-7"
            style={{ background: "var(--surface)" }}
          >
            <SectionLabel index="04">Skills assessed</SectionLabel>
            <ul className="grid sm:grid-cols-2 gap-3">
              {scenario.instrument.skills.map((sk, i) => (
                <li
                  key={sk.id}
                  className="p-4 border border-ink/10"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="flex items-center justify-between mb-2">
                    <span className="font-display text-xs text-brand font-semibold tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ink/70 text-[11px] font-display uppercase tracking-widest">
                      Weight {sk.weight}%
                    </span>
                  </span>
                  <span className="block font-display font-semibold text-ink text-sm mb-1">{sk.name}</span>
                  <span className="block text-ink/75 text-xs leading-relaxed">{sk.desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-ink/70 text-xs mt-4 leading-relaxed">
              The behavioural indicators under each skill are not shown before the conversation, so every
              participant meets the same unprompted challenge. The report lists them with their anchors and
              your quoted words.
            </p>
          </section>

          {/* Rules */}
          <section
            className="md:col-span-5 border border-ink/10 p-7"
            style={{ background: "var(--surface)" }}
          >
            <SectionLabel index="05">How this assessment runs</SectionLabel>
            <dl className="space-y-3">
              {RULES.map((r) => (
                <div key={r.k} className="flex gap-3">
                  <dt className="w-32 flex-none font-display font-semibold text-ink text-sm">{r.k}</dt>
                  <dd className="text-ink/80 text-sm leading-relaxed">{r.v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* Instrument status */}
        <section className="border border-ink/10 p-7" style={{ background: "var(--surface)" }}>
          <SectionLabel index="06">What this score may be used for</SectionLabel>
          <p className="text-ink/80 text-sm leading-relaxed mb-4 max-w-3xl">
            This instrument is on rung {scenario.instrument.claimRung} of 4 ({rung.title}). {rung.claim}{" "}
            {rung.fitFor} The rung is printed on the report and on the PDF.
          </p>
          <ClaimLadderPanel current={scenario.instrument.claimRung} />
        </section>

        {/* Begin */}
        <section
          className="border p-7 grid md:grid-cols-12 gap-6 items-center"
          style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.45)" }}
        >
          {completed ? (
            <>
              <div className="md:col-span-8">
                <h2 className="font-display font-semibold text-ink text-lg mb-1">Assessment complete</h2>
                <p className="text-ink/80 text-sm leading-relaxed">
                  You took this assessment on{" "}
                  {new Date(completed.completedAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}{" "}
                  and scored{" "}
                  <span className="font-display font-semibold text-ink">{completed.scores.overall}/10</span>.
                  The one attempt has been used; the report is saved under {completed.id}.
                </p>
              </div>
              <div className="md:col-span-4 flex md:justify-end">
                <button
                  onClick={() => onViewReport(completed)}
                  className="inline-flex items-center justify-center gap-3 px-6 py-3.5 font-display font-semibold text-white text-sm tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                  style={{ background: "var(--accent)" }}
                >
                  Open the report
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="md:col-span-8">
                <h2 className="font-display font-semibold text-ink text-lg mb-2">Ready to begin?</h2>
                <label className="flex items-start gap-3 text-sm text-ink/85 cursor-pointer">
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
              </div>
              <div className="md:col-span-4 flex md:justify-end">
                <button
                  onClick={onBegin}
                  disabled={!confirmed}
                  className="inline-flex items-center justify-center gap-3 px-6 py-3.5 font-display font-semibold text-white text-sm tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed"
                  style={{ background: confirmed ? "var(--accent)" : "rgb(var(--ink) / 0.35)" }}
                >
                  Begin the assessment
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

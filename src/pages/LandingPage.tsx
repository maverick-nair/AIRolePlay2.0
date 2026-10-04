import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import BoxField from "../components/BoxField";
import SectionLabel from "../components/SectionLabel";
import RollingNumber from "../components/RollingNumber";
import BadgeMedal from "../components/BadgeMedal";
import { PLAYERS_COMPLETED, PORTRAIT_SRC, SCENE_SRC } from "../data/scenario";
import { BADGES } from "../data/badges";
import type { Report } from "../domain/report";
import type { Difficulty, Mode, Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";

export type StartOptions = { difficulty: Difficulty; hints: boolean };

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "measured", label: "Measured", desc: "Firm but fair. Rewards good questions." },
  { id: "firm", label: "Firm", desc: "Pushes back on vague claims. The standard." },
  { id: "hardball", label: "Hardball", desc: "Impatient, sceptical, concedes nothing for free." },
];

export default function LandingPage({
  scenario,
  attempts,
  assessment,
  onStart,
  onViewReport,
}: {
  scenario: Scenario;
  attempts: Report[];
  assessment: Report | null;
  onStart: (mode: Mode, options: StartOptions) => void;
  onViewReport: (report: Report) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("firm");
  const [hints, setHints] = useState(true);
  const practice = attempts.filter((a) => a.mode === "practice");
  const best = practice.length ? Math.max(...practice.map((a) => a.scores.overall)) : null;
  const rung = CLAIM_LADDER[scenario.instrument.claimRung];
  const totalXp = scenario.instrument.objectives.reduce((a, o) => a + o.xp, 0);
  const minutes = Math.round(scenario.durationSeconds / 60);
  const persona = scenario.stimulus.persona;
  const startPractice = () => onStart("practice", { difficulty, hints });

  const Arrow = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="transition-transform duration-200 group-hover:translate-x-0.5"
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="relative isolate min-h-full overflow-auto" style={{ background: "transparent" }}>
      <div aria-hidden className="box-pattern" />
      <BoxField />
      {/* Nav */}
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-10 h-16 border-b border-ink/10"
        style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <span className="text-white text-sm font-bold font-display leading-none">AI</span>
          </div>
          <span className="text-ink font-display font-semibold text-base tracking-tight">RolePlay</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
            <span className="text-ink/70 text-xs font-medium font-display tracking-wide uppercase">
              Ready to Join
            </span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero: text 70% / portrait 30% */}
      <header className="max-w-7xl mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-14 animate-fade-in-up">
        <div className="grid md:grid-cols-10 gap-10 md:gap-12 items-center">
          <div className="md:col-span-7">
            <div
              className="inline-flex items-center gap-2.5 mb-7 px-3 py-1 text-xs font-medium font-display tracking-wide"
              style={{ background: "rgb(var(--accent-rgb) / 0.12)", color: "var(--brand)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              {scenario.category}
            </div>
            <h1 className="font-display font-bold text-4xl md:text-6xl text-ink tracking-tight leading-[1.03] mb-6">
              The Renewal
              <br />
              with {persona.name}
            </h1>
            <p className="text-ink/70 text-sm leading-relaxed max-w-xl mb-9">
              Step in as the account executive on a seven-figure renewal. A tough procurement lead, a cheaper
              rival quote, and a Friday deadline. {minutes} adaptive minutes that score how you hold value
              under pressure.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={startPractice}
                className="group inline-flex items-center gap-3 px-8 py-4 font-display font-semibold text-white text-sm tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
              >
                Practise
                <Arrow />
              </button>
              <a
                href="#modes"
                className="group inline-flex items-center gap-3 px-6 py-4 font-display font-semibold text-ink text-sm tracking-wide border border-ink/20 transition-colors hover:border-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              >
                {assessment ? "Assessment complete" : "Take the assessment"}
                <Arrow />
              </a>
              <div className="flex items-center gap-5 text-ink/75 text-sm font-display">
                <span>{minutes} min</span>
                <span className="w-px h-3.5 bg-ink/15" />
                <span>{scenario.instrument.objectives.length} Objectives</span>
                <span className="w-px h-3.5 bg-ink/15" />
                <span>Up to {totalXp} XP</span>
              </div>
            </div>

            {/* Player card */}
            <div
              className="mt-10 grid grid-cols-2 sm:grid-cols-4 border border-ink/15 max-w-2xl"
              style={{ background: "var(--surface)" }}
            >
              {[
                {
                  k: "Level",
                  v: "Competent",
                  sub: (
                    <span className="block mt-2 h-1 w-full" style={{ background: "rgb(var(--ink) / 0.12)" }}>
                      <span className="block h-full" style={{ width: "30%", background: "var(--brand)" }} />
                    </span>
                  ),
                },
                {
                  k: "Season XP",
                  v: <RollingNumber value={560} />,
                  sub: <span className="text-ink/75 text-xs">140 XP to Proficient</span>,
                },
                {
                  k: "Practice Runs",
                  v: <span>{practice.length}</span>,
                  sub: (
                    <span className="text-ink/75 text-xs">
                      {best === null ? "No attempts yet" : `Best ${best}/10`}
                    </span>
                  ),
                },
                {
                  k: "Season Rank",
                  v: "#4",
                  sub: <span className="text-ink/75 text-xs">of {PLAYERS_COMPLETED} players</span>,
                },
              ].map((c, i) => (
                <div
                  key={c.k}
                  className={`p-4 ${i ? "border-l border-ink/10" : ""} ${i === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""} ${i === 3 ? "max-sm:border-t" : ""}`}
                >
                  <p className="text-ink/75 text-[10px] font-display uppercase tracking-widest mb-1">{c.k}</p>
                  <p className="font-display font-bold text-ink text-lg">{c.v}</p>
                  {c.sub}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 max-w-2xl">
              <span className="text-ink/75 text-xs font-display uppercase tracking-widest mr-1">
                Badges up for grabs
              </span>
              {BADGES.map((b) => (
                <span key={b.id} className="flex items-center gap-2 text-xs text-ink/85" title={b.desc}>
                  <BadgeMedal mark={b.mark} earned={false} size={26} />
                  <span className="hidden md:inline">{b.name}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Portrait */}
          <div className="md:col-span-3">
            <figure
              className="relative aspect-[3/4] w-full overflow-hidden"
              style={{ background: "var(--surface-2)" }}
            >
              <img
                src={PORTRAIT_SRC}
                alt={persona.portraitAlt}
                className="w-full h-full object-cover"
                style={{ filter: "grayscale(0.2) contrast(1.05)" }}
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
                  {persona.role}, {persona.organisation} · Your client
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </header>

      {/* Scene band */}
      <section className="max-w-7xl mx-auto px-6 md:px-10 pb-14">
        <div
          className="relative min-h-64 w-full overflow-hidden border border-ink/10 flex items-center"
          style={{ background: "var(--surface-2)" }}
        >
          <img
            src={SCENE_SRC}
            alt="A modern glass-walled meeting room"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "grayscale(0.35) brightness(0.5)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, var(--bg) 0%, color-mix(in srgb, var(--bg) 97%, transparent) 55%, color-mix(in srgb, var(--bg) 35%, transparent) 100%)",
            }}
          />
          <div className="relative flex flex-col justify-center px-7 md:px-10 py-8 max-w-xl">
            <p className="font-display text-xs font-semibold tracking-[0.2em] text-brand mb-2">THE SCENE</p>
            <p className="text-ink text-sm leading-relaxed">{scenario.stimulus.player.scene}</p>
          </div>
        </div>
      </section>

      {/* Briefing: concise, text-forward */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 pb-16 animate-fade-in-up">
        <div
          className="grid md:grid-cols-3 border border-ink/10 mb-6"
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
          <section
            className="p-7"
            style={{ background: "rgba(244,63,94,0.05)", boxShadow: "inset 0 0 0 1px rgba(244,63,94,0.25)" }}
          >
            <div className="flex items-baseline gap-3 mb-5">
              <span className="font-display text-xs font-semibold tracking-[0.2em] text-danger tabular-nums">
                03
              </span>
              <span className="h-px flex-none w-6" style={{ background: "rgba(244,63,94,0.4)" }} />
              <h2 className="font-display font-semibold text-danger text-base tracking-tight">
                The Challenge
              </h2>
            </div>
            <p className="text-ink/85 text-sm leading-relaxed">{scenario.stimulus.player.challenge}</p>
          </section>
        </div>

        {/* Skills + Objectives */}
        <div className="grid md:grid-cols-12 gap-6 mb-6">
          <section
            className="md:col-span-7 border border-ink/10 p-7 flex flex-col"
            style={{ background: "var(--surface)" }}
          >
            <SectionLabel index="04">Skills being Assessed</SectionLabel>
            <ul className="flex-1 grid sm:grid-cols-2 auto-rows-fr gap-3">
              {scenario.instrument.skills.map((sk, i) => (
                <li
                  key={sk.id}
                  className="group relative flex flex-col gap-3 p-4 border border-ink/10 transition-colors hover:border-[var(--brand)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-display text-xs text-brand font-semibold tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-ink/70 text-[10px] font-display uppercase tracking-widest">
                      {sk.weight}%
                    </span>
                  </span>
                  <span>
                    <span className="block font-display font-semibold text-ink text-sm mb-1">{sk.name}</span>
                    <span className="block text-ink/75 text-xs leading-relaxed">{sk.desc}</span>
                  </span>
                  <details className="mt-auto">
                    <summary className="cursor-pointer text-[11px] font-display font-semibold text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded">
                      What we look for ({sk.indicators.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {sk.indicators.map((ind) => (
                        <li key={ind.id} className="text-[11px] text-ink/75 leading-snug flex gap-1.5">
                          <span aria-hidden className="mt-1.5 w-1 h-1 rounded-full bg-brand flex-none" />
                          {ind.label}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
            <p className="text-ink/70 text-xs mt-4 leading-relaxed">
              Each skill is scored from these behaviours in your own words. What Strong, Adequate, Weak and
              Harmful look like for each is written down and shown with your evidence in the report.
            </p>
          </section>
          <section
            className="md:col-span-5 border border-ink/10 p-7 flex flex-col"
            style={{ background: "var(--surface)" }}
          >
            <SectionLabel index="05">Objectives</SectionLabel>
            <p className="text-ink/75 text-xs leading-relaxed mb-3">
              How each quest is judged stays hidden during an assessment. In practice you can reveal what
              counts.
            </p>
            <ul className="mb-7">
              {scenario.instrument.objectives.map((o) => (
                <li
                  key={o.id}
                  className="flex items-baseline justify-between gap-4 py-3 border-t border-ink/10 first:border-t-0"
                >
                  <span className="flex items-start gap-3 text-sm leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 flex-none bg-brand" />
                    <span>
                      <span className="block font-display font-semibold text-ink">{o.label}</span>
                      <span className="block text-ink/75">{o.sub}</span>
                    </span>
                  </span>
                  <span className="font-display font-semibold text-brand text-sm tabular-nums whitespace-nowrap">
                    +{o.xp} XP
                  </span>
                </li>
              ))}
            </ul>
            <div
              className="mt-auto rounded-xl p-4 border border-ink/10"
              style={{ background: "var(--surface-2)" }}
            >
              <p className="text-ink/75 text-[10px] font-display uppercase tracking-widest mb-1">
                Instrument status
              </p>
              <p className="font-display font-semibold text-ink text-sm">
                Rung {scenario.instrument.claimRung} of 4: {rung.title}
              </p>
              <p className="text-ink/75 text-xs mt-1 leading-relaxed">{rung.fitFor}</p>
            </div>
          </section>
        </div>

        {/* Mode chooser */}
        <section id="modes" className="scroll-mt-20">
          <SectionLabel index="06">How do you want to play?</SectionLabel>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Practice */}
            <div
              className="border border-ink/10 p-7 flex flex-col gap-5"
              style={{ background: "var(--surface)" }}
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="font-display font-semibold text-ink text-lg">Practise this conversation</h3>
                  <span
                    className="px-2 py-0.5 text-[10px] font-display uppercase tracking-wider"
                    style={{ background: "rgba(52,211,153,0.14)", color: "var(--ok)" }}
                  >
                    Unlimited
                  </span>
                </div>
                <ul className="space-y-1.5 text-sm text-ink/80">
                  {[
                    "Retry any of your turns. The persona rewinds with you.",
                    "Criteria available on request, hints as you go.",
                    "Choose how hard the persona pushes.",
                    "Scores show your trend across attempts and are for you.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 w-1 h-1 rounded-full bg-[var(--ok)] flex-none" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <fieldset>
                <legend className="text-ink/75 text-[10px] font-display uppercase tracking-widest mb-2">
                  Persona difficulty
                </legend>
                <div className="grid grid-cols-3 gap-2" role="radiogroup">
                  {DIFFICULTIES.map((d) => {
                    const on = difficulty === d.id;
                    return (
                      <button
                        key={d.id}
                        role="radio"
                        aria-checked={on}
                        onClick={() => setDifficulty(d.id)}
                        className="text-left p-3 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] min-h-[44px]"
                        style={{
                          background: on ? "rgb(var(--accent-rgb) / 0.12)" : "var(--surface-2)",
                          borderColor: on ? "rgb(var(--accent-rgb) / 0.6)" : "rgb(var(--ink) / 0.12)",
                        }}
                      >
                        <span className="block font-display font-semibold text-ink text-sm">{d.label}</span>
                        <span className="block text-ink/75 text-[11px] leading-snug mt-0.5">{d.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="flex items-center gap-3 text-sm text-ink/85 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hints}
                  onChange={(e) => setHints(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                />
                Show hints in the moment when a turn misses an opportunity
              </label>
              <div className="mt-auto flex flex-wrap items-center gap-4">
                <button
                  onClick={startPractice}
                  className="group inline-flex items-center justify-center gap-3 px-6 py-3.5 font-display font-semibold text-white text-sm tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                  style={{ background: "var(--accent)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                >
                  Start practising
                  <Arrow />
                </button>
                {practice.length > 0 && (
                  <button
                    onClick={() => onViewReport(practice[practice.length - 1])}
                    className="text-sm font-display font-semibold text-brand hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded"
                  >
                    View last practice report
                  </button>
                )}
              </div>
            </div>

            {/* Assessment */}
            <div
              className="border p-7 flex flex-col gap-5"
              style={{ background: "var(--surface)", borderColor: "rgb(var(--accent-rgb) / 0.35)" }}
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <h3 className="font-display font-semibold text-ink text-lg">Take the assessment</h3>
                  <span
                    className="px-2 py-0.5 text-[10px] font-display uppercase tracking-wider"
                    style={{ background: "rgb(var(--accent-rgb) / 0.14)", color: "var(--brand)" }}
                  >
                    One attempt
                  </span>
                </div>
                <ul className="space-y-1.5 text-sm text-ink/80">
                  {[
                    `One attempt, ${minutes} minutes. The call ends when time runs out.`,
                    "The persona follows a fixed schedule of critical incidents, so everyone faces the same challenge.",
                    "Criteria are hidden. No hints, no rewind.",
                    "Every rating in the report is tied to your quoted words.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 w-1 h-1 rounded-full bg-brand flex-none" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className="rounded-xl p-4 border border-ink/10 text-xs text-ink/75 leading-relaxed"
                style={{ background: "var(--surface-2)" }}
              >
                <span className="font-semibold text-ink/85">Before you start.</span> This instrument is on
                rung {scenario.instrument.claimRung} of the claim ladder: {rung.claim.toLowerCase()}{" "}
                {rung.fitFor} The pass mark is {scenario.passScore} of 10.
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-4">
                {assessment ? (
                  <>
                    <div className="text-sm text-ink/80">
                      <span className="font-display font-semibold text-ink">Completed</span>{" "}
                      {new Date(assessment.completedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })},
                      scored{" "}
                      <span className="font-display font-semibold text-ink">
                        {assessment.scores.overall}/10
                      </span>
                    </div>
                    <button
                      onClick={() => onViewReport(assessment)}
                      className="group inline-flex items-center justify-center gap-3 px-6 py-3.5 font-display font-semibold text-ink text-sm tracking-wide border border-ink/20 hover:border-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    >
                      View assessment report
                      <Arrow />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onStart("assessment", { difficulty: "firm", hints: false })}
                    className="group inline-flex items-center justify-center gap-3 px-6 py-3.5 font-display font-semibold text-ink text-sm tracking-wide border border-ink/20 hover:border-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  >
                    Begin the one attempt
                    <Arrow />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

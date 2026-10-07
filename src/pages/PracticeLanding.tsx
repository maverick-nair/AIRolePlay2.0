import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import BoxField from "../components/BoxField";
import SectionLabel from "../components/SectionLabel";
import RollingNumber from "../components/RollingNumber";
import BadgeMedal from "../components/BadgeMedal";
import { PLAYERS_COMPLETED, PORTRAIT_SRC } from "../data/scenario";
import { BADGES } from "../data/badges";
import type { Report } from "../domain/report";
import type { Difficulty, Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";
import type { Product } from "../products";
import BuildStamp from "../components/BuildStamp";

export type PracticeOptions = { difficulty: Difficulty; hints: boolean };

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "measured", label: "Measured", desc: "Firm but fair. Rewards good questions." },
  { id: "firm", label: "Firm", desc: "Pushes back on vague claims. The standard." },
  { id: "hardball", label: "Hardball", desc: "Impatient, sceptical, concedes nothing for free." },
];

// AI RolePlay landing: the practice product. Built to fit a laptop viewport (about 1500 by 750):
// the first screen holds the title, the start controls, the player card and the scene; the brief,
// skills, objectives and run setup follow in one more screen. No assessment lives here.
export default function PracticeLanding({
  product,
  scenario,
  attempts,
  runsLeft,
  onStart,
  onViewReport,
}: {
  product: Product;
  scenario: Scenario;
  attempts: Report[];
  runsLeft: number;
  onStart: (options: PracticeOptions) => void;
  onViewReport: (report: Report) => void;
}) {
  const [difficulty, setDifficulty] = useState<Difficulty>("firm");
  const [hints, setHints] = useState(true);
  const best = attempts.length ? Math.max(...attempts.map((a) => a.scores.overall)) : null;
  const last = attempts[attempts.length - 1];
  const maxRuns = scenario.maxPracticeAttempts;
  const exhausted = runsLeft <= 0;
  const rung = CLAIM_LADDER[scenario.instrument.claimRung];
  const totalXp = scenario.instrument.objectives.reduce((a, o) => a + o.xp, 0);
  const minutes = Math.round(scenario.durationSeconds / 60);
  const persona = scenario.stimulus.persona;
  const player = scenario.stimulus.player;
  const start = () => {
    if (!exhausted) onStart({ difficulty, hints });
  };

  const Arrow = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
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

  const StartButton = () => (
    <button
      onClick={start}
      disabled={exhausted}
      className="group inline-flex items-center justify-center gap-3 px-7 py-3.5 font-display font-semibold text-white text-sm tracking-wide transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed"
      style={{ background: exhausted ? "rgb(var(--ink) / 0.35)" : "var(--accent)" }}
      onMouseEnter={(e) => {
        if (!exhausted) e.currentTarget.style.background = "var(--accent-hover)";
      }}
      onMouseLeave={(e) => {
        if (!exhausted) e.currentTarget.style.background = "var(--accent)";
      }}
    >
      {exhausted ? `All ${maxRuns} runs used` : "Start practising"}
      {!exhausted && <Arrow />}
    </button>
  );

  const stats = [
    {
      k: "Level",
      v: "Competent",
      sub: (
        <span
          className="block mt-1.5 h-1 w-full overflow-hidden"
          style={{ background: "rgb(var(--ink) / 0.12)" }}
        >
          <span className="block h-full" style={{ width: "28%", background: "var(--brand)" }} />
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
      v: (
        <span>
          {attempts.length}
          <span className="text-ink/70 text-sm font-medium">/{maxRuns}</span>
        </span>
      ),
      sub: (
        <span className="text-ink/75 text-xs">
          {exhausted
            ? `All runs used. Best ${best}/10`
            : best === null
              ? `${runsLeft} runs available`
              : `Best ${best}/10, ${runsLeft} left`}
        </span>
      ),
    },
    {
      k: "Season Rank",
      v: "#4",
      sub: <span className="text-ink/75 text-xs">of {PLAYERS_COMPLETED} players</span>,
    },
  ];

  return (
    <div className="relative isolate min-h-full overflow-auto" style={{ background: "transparent" }}>
      <div aria-hidden className="box-pattern" />
      <BoxField />
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-6 md:px-10 h-14 border-b border-ink/10"
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
          <div className="hidden sm:flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
            <span className="text-ink/70 text-xs font-medium font-display tracking-wide uppercase">
              Practice space
            </span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      {/* First screen: title and start on the left, persona and scene on the right */}
      <main>
        <header className="max-w-7xl mx-auto px-6 md:px-10 pt-8 md:pt-10 pb-6 animate-fade-in-up">
          <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <div className="lg:col-span-7 flex flex-col">
              <div
                className="self-start inline-flex items-center gap-2.5 mb-4 px-3 py-1 text-xs font-medium font-display tracking-wide"
                style={{ background: "rgb(var(--accent-rgb) / 0.12)", color: "var(--brand)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                {scenario.category}
              </div>
              <h1 className="font-display font-bold text-4xl md:text-[3.25rem] text-ink tracking-[-0.02em] leading-[0.98] mb-3">
                The Renewal <br className="hidden md:block" />
                with {persona.name}
              </h1>
              <p className="text-ink/70 text-sm leading-relaxed max-w-xl mb-4">
                {product.tagline} Step in as the account executive on a seven-figure renewal. A tough
                procurement lead, a cheaper rival quote, and a Friday deadline. Try it, rewind it, try it
                again.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <StartButton />
                <div className="flex items-center gap-4 text-ink/75 text-sm font-display">
                  <span>About {minutes} min</span>
                  <span className="w-px h-3.5 bg-ink/15" />
                  <span>{scenario.instrument.objectives.length} Objectives</span>
                  <span className="w-px h-3.5 bg-ink/15" />
                  <span>Up to {totalXp} XP</span>
                </div>
              </div>

              {/* Run setup: difficulty, hints, runs left */}
              <section
                id="setup"
                className="scroll-mt-16 border border-ink/15 p-4 mb-4"
                style={{ background: "var(--surface)" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
                  <h2 className="font-display font-semibold text-ink text-sm tracking-tight">
                    Set up this run
                  </h2>
                  <p className="text-ink/75 text-xs" role="status">
                    {exhausted
                      ? `All ${maxRuns} practice runs on this scenario are used. Your reports stay available below.`
                      : `Up to ${maxRuns} runs on this scenario, ${runsLeft} left. Retry any turn, criteria on request, nothing here is a grade.`}
                    {last && (
                      <>
                        {" "}
                        Last run scored{" "}
                        <span className="text-ink font-semibold">{last.scores.overall}/10</span>.{" "}
                        <button
                          onClick={() => onViewReport(last)}
                          className="text-brand font-display font-semibold hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded"
                        >
                          Open that report
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
                  <fieldset>
                    <legend className="text-ink/75 text-[11px] font-display uppercase tracking-widest mb-2">
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
                            className="text-left px-3 py-2 border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] min-h-[44px]"
                            style={{
                              background: on ? "rgb(var(--accent-rgb) / 0.12)" : "var(--surface-2)",
                              borderColor: on ? "rgb(var(--accent-rgb) / 0.6)" : "rgb(var(--ink) / 0.12)",
                            }}
                          >
                            <span className="block font-display font-semibold text-ink text-sm">
                              {d.label}
                            </span>
                            <span className="block text-ink/75 text-[11px] leading-snug">{d.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label className="flex items-center gap-2.5 text-xs text-ink/85 cursor-pointer pb-1 sm:max-w-[12rem] leading-snug">
                    <input
                      type="checkbox"
                      checked={hints}
                      onChange={(e) => setHints(e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent)] flex-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    />
                    Show hints when a turn misses an opportunity
                  </label>
                </div>
              </section>

              {/* Player card */}
              <div
                className="grid grid-cols-2 sm:grid-cols-4 border border-ink/15"
                style={{ background: "var(--surface)" }}
              >
                {stats.map((c, i) => (
                  <div
                    key={c.k}
                    className={`px-3.5 py-3 ${i ? "border-l border-ink/10" : ""} ${i === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""} ${i === 3 ? "max-sm:border-t" : ""}`}
                  >
                    <p className="text-ink/75 text-[11px] font-display uppercase tracking-widest mb-0.5">
                      {c.k}
                    </p>
                    <p className="font-display font-bold text-ink text-lg leading-tight">{c.v}</p>
                    {c.sub}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-ink/75 text-[11px] font-display uppercase tracking-widest mr-1">
                  Badges up for grabs
                </span>
                {BADGES.map((b) => (
                  <span key={b.id} className="flex items-center gap-1.5 text-xs text-ink/85" title={b.desc}>
                    <BadgeMedal mark={b.mark} earned={false} size={24} />
                    <span className="hidden 2xl:inline">{b.name}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Persona and scene: a 1:1 portrait beside a text panel of the same size */}
            <aside
              className="lg:col-span-5 self-start grid grid-cols-2 border border-ink/10 overflow-hidden"
              style={{ background: "var(--surface)" }}
            >
              <figure
                className="relative aspect-square self-start overflow-hidden"
                style={{ background: "var(--surface-2)" }}
              >
                <img
                  src={PORTRAIT_SRC}
                  alt={persona.portraitAlt}
                  className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
                />
              </figure>
              <div className="min-h-full p-5 flex flex-col">
                <p className="font-display font-semibold text-ink text-lg leading-tight">{persona.name}</p>
                <p className="text-ink/75 text-xs mb-3">
                  {persona.role}, {persona.organisation} · Your client
                </p>
                <p className="font-display text-[11px] font-semibold tracking-[0.2em] text-brand mb-1.5">
                  THE SCENE
                </p>
                <p className="text-ink/85 text-[13px] leading-snug">{player.scene}</p>
              </div>
            </aside>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 md:px-10 pb-10 space-y-5 animate-fade-in-up">
          {/* Briefing */}
          <div
            className="grid md:grid-cols-3 border border-ink/10"
            style={{ background: "rgb(var(--ink) / 0.08)", gap: 1 }}
          >
            <section className="p-5" style={{ background: "var(--surface)" }}>
              <SectionLabel index="01">Your Role</SectionLabel>
              <p className="text-ink/80 text-sm leading-relaxed">{player.role}</p>
            </section>
            <section className="p-5" style={{ background: "var(--surface)" }}>
              <SectionLabel index="02">Your Goal</SectionLabel>
              <p className="text-ink/80 text-sm leading-relaxed">{player.goal}</p>
            </section>
            <section
              className="p-5"
              style={{
                background: "rgba(244,63,94,0.05)",
                boxShadow: "inset 0 0 0 1px rgba(244,63,94,0.25)",
              }}
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
              <p className="text-ink/85 text-sm leading-relaxed">{player.challenge}</p>
            </section>
          </div>

          {/* Skills + Objectives */}
          <div className="grid lg:grid-cols-12 gap-5">
            <section
              className="lg:col-span-8 border border-ink/10 p-5 flex flex-col"
              style={{ background: "var(--surface)" }}
            >
              <SectionLabel index="04">Skills you are practising</SectionLabel>
              <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {scenario.instrument.skills.map((sk, i) => (
                  <li
                    key={sk.id}
                    className="group relative flex flex-col gap-2 p-3.5 border border-ink/10 transition-colors hover:border-[var(--brand)]"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-display text-xs text-brand font-semibold tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-ink/70 text-[11px] font-display uppercase tracking-widest">
                        {sk.weight}%
                      </span>
                    </span>
                    <span>
                      <span className="block font-display font-semibold text-ink text-sm mb-0.5">
                        {sk.name}
                      </span>
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
              <p className="text-ink/70 text-xs mt-3 leading-relaxed">
                In practice the criteria are yours to see. Each behaviour has written anchors for Strong,
                Adequate, Weak and Harmful, and the report shows them beside your own words.
              </p>
            </section>
            <section
              className="lg:col-span-4 border border-ink/10 p-5 flex flex-col"
              style={{ background: "var(--surface)" }}
            >
              <SectionLabel index="05">Objectives</SectionLabel>
              <ul>
                {scenario.instrument.objectives.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-baseline justify-between gap-4 py-2.5 border-t border-ink/10 first:border-t-0"
                  >
                    <span className="flex items-start gap-3 text-sm leading-snug">
                      <span className="mt-1.5 w-1.5 h-1.5 flex-none bg-brand" />
                      <span>
                        <span className="block font-display font-semibold text-ink">{o.label}</span>
                        <span className="block text-ink/75 text-xs mt-0.5">{o.sub}</span>
                      </span>
                    </span>
                    <span className="font-display font-semibold text-brand text-sm tabular-nums whitespace-nowrap">
                      +{o.xp} XP
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4">
                <div
                  className="rounded-xl p-3.5 border border-ink/10"
                  style={{ background: "var(--surface-2)" }}
                >
                  <p className="text-ink/75 text-[11px] font-display uppercase tracking-widest mb-1">
                    Feedback status
                  </p>
                  <p className="font-display font-semibold text-ink text-sm">
                    Rung {scenario.instrument.claimRung} of 4: {rung.title}
                  </p>
                  <p className="text-ink/75 text-xs mt-1 leading-relaxed">
                    Practice scores are for you. {rung.fitFor}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <BuildStamp product={product.name} />
    </div>
  );
}

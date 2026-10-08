import { useRef, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import BoxField from "../components/BoxField";
import SectionLabel from "../components/SectionLabel";
import BadgeMedal from "../components/BadgeMedal";
import { PORTRAIT_SRC } from "../data/scenario";
import { BADGES } from "../data/badges";
import type { Report } from "../domain/report";
import type { Difficulty, Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";
import { LEVELS, levelFor, levelProgress } from "../domain/scoring";
import { careerXp } from "../store/attempts";
import type { Product } from "../products";
import BuildStamp from "../components/BuildStamp";

export type PracticeOptions = { difficulty: Difficulty; hints: boolean };

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "measured", label: "Measured", desc: "Firm but fair. Rewards good questions." },
  { id: "firm", label: "Firm", desc: "Pushes back on vague claims. The standard." },
  { id: "hardball", label: "Hardball", desc: "Impatient, sceptical, concedes nothing for free." },
];

// AI RolePlay lobby: the persona, the stakes in one line, the facts of the run and one way in.
// The full brief lives in a drawer, so the first screen is a decision, not a document. Progress
// shows only what saved runs earned; there is no seeded XP, level or rank.
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
  const brief = useRef<HTMLDialogElement>(null);
  const best = attempts.length ? Math.max(...attempts.map((a) => a.scores.overall)) : null;
  const last = attempts[attempts.length - 1];
  const maxRuns = scenario.maxPracticeAttempts;
  const exhausted = runsLeft <= 0;
  const rung = CLAIM_LADDER[scenario.instrument.claimRung];
  const minutes = Math.round(scenario.durationSeconds / 60);
  const persona = scenario.stimulus.persona;
  const player = scenario.stimulus.player;
  const xp = careerXp(attempts);
  const level = levelFor(xp);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const earned = new Set(attempts.flatMap((a) => a.stats?.badges ?? []));
  const start = () => {
    if (!exhausted) onStart({ difficulty, hints });
  };

  const chip =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-[14px] border border-ink/15 text-ink/85";

  return (
    <div className="relative isolate min-h-full overflow-auto" style={{ background: "transparent" }}>
      <div aria-hidden className="box-pattern" />
      <BoxField />
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 md:px-10 h-14 border-b border-ink/10"
        style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center" style={{ background: "var(--accent)" }}>
            <span className="text-white text-xs font-bold font-display leading-none">{product.mark}</span>
          </div>
          <span className="text-ink font-display font-semibold text-base tracking-tight">{product.name}</span>
          <span className="hidden sm:inline text-ink/75 text-xs uppercase tracking-widest border-l border-ink/15 pl-3">
            {product.line}
          </span>
        </div>
        <ThemeToggle />
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 pt-5 md:pt-10 pb-12 animate-fade-in-up">
        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 sm:gap-6 md:gap-10 items-center">
          {/* The persona you are about to meet */}
          <figure className="relative w-24 sm:w-full sm:max-w-[22rem] md:max-w-none sm:mx-auto aspect-square overflow-hidden rounded-[14px] border border-ink/10">
            <img
              src={PORTRAIT_SRC}
              alt={persona.portraitAlt}
              className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
              style={{ background: "var(--surface-2)" }}
            />
            <figcaption
              className="hidden sm:block absolute inset-x-0 bottom-0 px-4 py-3"
              style={{
                background:
                  "linear-gradient(transparent, color-mix(in srgb, var(--bg) 88%, transparent) 45%)",
              }}
            >
              <span className="block font-display font-semibold text-ink text-lg leading-tight">
                {persona.name}
              </span>
              <span className="block text-ink/85 text-sm">
                {persona.role}, {persona.organisation}
              </span>
            </figcaption>
          </figure>

          <div className="flex flex-col">
            <p
              className="self-start inline-flex items-center gap-2 mb-3 px-3 py-1 text-sm font-medium rounded-[14px]"
              style={{ background: "rgb(var(--accent-rgb) / 0.12)", color: "var(--brand)" }}
            >
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-brand" />
              {scenario.category}
            </p>
            <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-ink tracking-[-0.02em] leading-[1.02]">
              The Renewal with {persona.name}
            </h1>
            <p className="text-ink/85 text-base md:text-lg leading-relaxed mt-3 max-w-2xl">
              {player.challenge}
            </p>

            <ul className="flex flex-wrap gap-2 mt-4 sm:mt-5" aria-label="About this run">
              <li className={chip}>About {minutes} min</li>
              <li className={chip}>{DIFFICULTIES.find((d) => d.id === difficulty)?.label} persona</li>
              <li className={chip}>
                {exhausted ? `All ${maxRuns} runs used` : `${runsLeft} of ${maxRuns} runs left`}
              </li>
              <li className={`${chip} max-sm:hidden`}>{scenario.instrument.objectives.length} objectives</li>
            </ul>

            {/* Run setup, compact: difficulty and hints */}
            <fieldset className="mt-4 sm:mt-5">
              <legend className="text-ink/75 text-xs uppercase tracking-widest mb-2">
                Persona difficulty
              </legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Persona difficulty">
                {DIFFICULTIES.map((d) => {
                  const on = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setDifficulty(d.id)}
                      title={d.desc}
                      className="text-left px-3 py-2 border rounded-[14px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] min-h-[44px]"
                      style={{
                        background: on ? "rgb(var(--accent-rgb) / 0.12)" : "var(--surface)",
                        borderColor: on ? "rgb(var(--accent-rgb) / 0.6)" : "rgb(var(--ink) / 0.15)",
                      }}
                    >
                      <span className="block font-display font-semibold text-ink text-sm">{d.label}</span>
                      <span className="hidden sm:block text-ink/75 text-xs leading-snug">{d.desc}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="mt-3 inline-flex items-center gap-2.5 text-sm text-ink/85 cursor-pointer self-start">
              <input
                type="checkbox"
                checked={hints}
                onChange={(e) => setHints(e.target.checked)}
                className="w-4 h-4 accent-[var(--accent)] flex-none"
              />
              Show hints when a turn misses an opportunity
            </label>

            <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={start}
                disabled={exhausted}
                className="group inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-[14px] font-display font-semibold text-white text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:cursor-not-allowed min-h-[48px]"
                style={{ background: exhausted ? "rgb(var(--ink) / 0.35)" : "var(--accent)" }}
              >
                {exhausted ? `All ${maxRuns} runs used` : "Start practising"}
                {!exhausted && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <button
                onClick={() => brief.current?.showModal()}
                className="inline-flex items-center px-5 py-3.5 rounded-[14px] font-display font-semibold text-ink text-base border border-ink/20 hover:border-ink/40 min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              >
                Read the brief
              </button>
            </div>
          </div>
        </div>

        {/* Skills, as chips. The criteria behind each one are in the brief. */}
        <section aria-labelledby="skills-heading" className="mt-10">
          <h2 id="skills-heading" className="text-ink/75 text-xs uppercase tracking-widest mb-3">
            Skills you are practising
          </h2>
          <ul className="flex flex-wrap gap-2">
            {scenario.instrument.skills.map((sk) => (
              <li
                key={sk.id}
                title={sk.desc}
                className="px-3 py-1.5 rounded-[14px] text-sm text-ink border border-ink/15"
                style={{ background: "var(--surface)" }}
              >
                {sk.name}
              </li>
            ))}
          </ul>
        </section>

        {/* Progress: only what saved runs earned */}
        <section
          aria-labelledby="progress-heading"
          className="mt-6 rounded-[14px] border border-ink/10 p-5 grid sm:grid-cols-[1fr_auto] gap-4 items-center"
          style={{ background: "var(--surface)" }}
        >
          <div>
            <h2 id="progress-heading" className="font-display font-semibold text-ink text-lg">
              {attempts.length === 0 ? "Your first run sets your baseline" : "Your progress on this scenario"}
            </h2>
            {attempts.length === 0 ? (
              <p className="text-ink/80 text-sm mt-1 leading-relaxed max-w-2xl">
                After it, this shows your level, XP and best score, and every report stays here to reopen. XP
                comes from the behaviours you show, not from how much you say.
              </p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <dt className="text-ink/75 text-xs uppercase tracking-widest">Level</dt>
                  <dd className="font-display font-bold text-ink text-lg">{level.name}</dd>
                  <dd
                    className="mt-1.5 h-1 w-full max-w-[8rem] overflow-hidden"
                    style={{ background: "rgb(var(--ink) / 0.12)" }}
                    aria-hidden
                  >
                    <span
                      className="block h-full"
                      style={{ width: `${levelProgress(xp)}%`, background: "var(--brand)" }}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-ink/75 text-xs uppercase tracking-widest">XP</dt>
                  <dd className="font-display font-bold text-ink text-lg tabular-nums">{xp}</dd>
                  {nextLevel && (
                    <dd className="text-ink/75 text-xs">
                      {nextLevel.floor - xp} to {nextLevel.name}
                    </dd>
                  )}
                </div>
                <div>
                  <dt className="text-ink/75 text-xs uppercase tracking-widest">Best score</dt>
                  <dd className="font-display font-bold text-ink text-lg tabular-nums">{best}/10</dd>
                  <dd className="text-ink/75 text-xs">
                    {attempts.length} of {maxRuns} runs
                  </dd>
                </div>
                <div>
                  <dt className="text-ink/75 text-xs uppercase tracking-widest">Badges</dt>
                  <dd className="font-display font-bold text-ink text-lg tabular-nums">
                    {earned.size}/{BADGES.length}
                  </dd>
                </div>
              </dl>
            )}
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            {last && (
              <button
                onClick={() => onViewReport(last)}
                className="text-brand font-display font-semibold text-sm hover:underline underline-offset-4 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              >
                Open your last report ({last.scores.overall}/10)
              </button>
            )}
            <ul className="flex gap-1.5" aria-label="Badges">
              {BADGES.map((b) => (
                <li key={b.id} title={`${b.name}: ${b.desc}`}>
                  <BadgeMedal mark={b.mark} earned={earned.has(b.id)} size={26} />
                  <span className="sr-only">
                    {b.name}, {earned.has(b.id) ? "earned" : "not earned yet"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* The full brief, on request */}
      <dialog
        ref={brief}
        aria-labelledby="brief-title"
        className="brief-drawer m-0 ml-auto h-full max-h-none w-full max-w-xl p-0 border-l border-ink/15 text-ink"
        style={{ background: "var(--bg)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) brief.current?.close();
        }}
      >
        <div className="h-full overflow-y-auto p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 id="brief-title" className="font-display font-bold text-2xl text-ink">
              The brief
            </h2>
            <button
              onClick={() => brief.current?.close()}
              aria-label="Close the brief"
              className="w-10 h-10 inline-flex items-center justify-center rounded-[14px] border border-ink/15 text-ink/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M2 2l10 10M12 2 2 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="space-y-6">
            <section>
              <SectionLabel index="01">The Scene</SectionLabel>
              <p className="text-ink/85 text-sm leading-relaxed">{player.scene}</p>
            </section>
            <section>
              <SectionLabel index="02">Your Role</SectionLabel>
              <p className="text-ink/85 text-sm leading-relaxed">{player.role}</p>
            </section>
            <section>
              <SectionLabel index="03">Your Goal</SectionLabel>
              <p className="text-ink/85 text-sm leading-relaxed">{player.goal}</p>
            </section>
            <section>
              <SectionLabel index="04">Objectives</SectionLabel>
              <ul className="space-y-2.5">
                {scenario.instrument.objectives.map((o) => (
                  <li key={o.id} className="flex items-baseline justify-between gap-4 text-sm">
                    <span>
                      <span className="block font-semibold text-ink">{o.label}</span>
                      <span className="block text-ink/80 text-sm">{o.sub}</span>
                    </span>
                    <span className="font-semibold text-brand tabular-nums whitespace-nowrap">
                      +{o.xp} XP
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <SectionLabel index="05">What we look for</SectionLabel>
              <p className="text-ink/80 text-sm leading-relaxed mb-3">
                In practice the criteria are yours to see. Each behaviour has written anchors for Strong,
                Adequate, Weak and Harmful, and the report shows them beside your own words.
              </p>
              <ul className="space-y-3">
                {scenario.instrument.skills.map((sk) => (
                  <li key={sk.id}>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-ink min-h-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
                        {sk.name}{" "}
                        <span className="text-ink/75 font-normal">({sk.indicators.length} behaviours)</span>
                      </summary>
                      <p className="text-ink/80 text-sm mt-1 leading-relaxed">{sk.desc}</p>
                      <ul className="mt-2 space-y-1">
                        {sk.indicators.map((ind) => (
                          <li key={ind.id} className="text-sm text-ink/80 leading-snug flex gap-2">
                            <span aria-hidden className="mt-2 w-1 h-1 rounded-full bg-brand flex-none" />
                            {ind.label}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
            <section
              className="rounded-[14px] border border-ink/10 p-4"
              style={{ background: "var(--surface)" }}
            >
              <p className="text-ink/75 text-xs uppercase tracking-widest mb-1">Feedback status</p>
              <p className="font-display font-semibold text-ink text-sm">
                Rung {scenario.instrument.claimRung} of 4: {rung.title}
              </p>
              <p className="text-ink/80 text-sm mt-1 leading-relaxed">
                Practice scores are for you. {rung.fitFor}
              </p>
            </section>
          </div>
          <button
            onClick={() => {
              brief.current?.close();
              start();
            }}
            disabled={exhausted}
            className="mt-6 w-full inline-flex items-center justify-center px-6 py-3.5 rounded-[14px] font-display font-semibold text-white min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed"
            style={{ background: exhausted ? "rgb(var(--ink) / 0.35)" : "var(--accent)" }}
          >
            {exhausted ? `All ${maxRuns} runs used` : "Start practising"}
          </button>
        </div>
      </dialog>
      <BuildStamp product={product.name} />
    </div>
  );
}

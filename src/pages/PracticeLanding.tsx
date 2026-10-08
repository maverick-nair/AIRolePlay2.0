import { useState, type ReactNode } from "react";
import AppShell from "../components/AppShell";
import Icon, { FlameGlyph, StarGlyph } from "../components/Icon";
import BadgeMedal from "../components/BadgeMedal";
import { PORTRAIT_SRC } from "../data/scenario";
import { BADGES } from "../data/badges";
import type { Report } from "../domain/report";
import type { Difficulty, Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";
import { LEVELS, levelFor, levelProgress } from "../domain/scoring";
import { careerXp } from "../store/attempts";
import { DAILY_GOAL_XP, dayStreak, weekStrip, weeklyQuests, xpToday } from "../lib/progress";
import type { Product } from "../products";

export type PracticeOptions = { difficulty: Difficulty; hints: boolean };

const DIFFICULTIES: { id: Difficulty; label: string; desc: string }[] = [
  { id: "measured", label: "Measured", desc: "Firm but fair. Rewards good questions." },
  { id: "firm", label: "Firm", desc: "Pushes back on vague claims. The standard." },
  { id: "hardball", label: "Hardball", desc: "Impatient, sceptical, concedes nothing for free." },
];

// A labelled block inside a cockpit panel.
function Block({
  title,
  aside,
  className = "",
  children,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <h3 className="flex items-baseline justify-between gap-2 t-small font-semibold text-ink/80 mb-1.5">
        {title}
        {aside && <span className="font-medium tabular-nums">{aside}</span>}
      </h3>
      {children}
    </section>
  );
}

function Bar({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  return (
    <div
      className="h-1.5 rounded-full overflow-hidden"
      style={{ background: "var(--edge)" }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
      />
    </div>
  );
}

// AI RolePlay home: one screen, laid out like a cockpit. Left is the situation (who you meet and why),
// the middle is what you are scored on, the right is the run you are about to start and the path so
// far; the header carries the game layer. Nothing is behind a tab, drawer or toggle. The behaviour
// criteria are the one thing held back: in practice they are shown on request during the call (What
// counts), as the instrument rules require. Streak, XP, level, goal, quests and badges come only from
// saved runs, so a first time learner starts at zero.
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
  const now = new Date();
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
  const streak = dayStreak(attempts, now);
  const today = xpToday(attempts, now);
  const week = weekStrip(attempts, now);
  const quests = weeklyQuests(attempts, now);
  const last = attempts[attempts.length - 1];
  const runNo = attempts.length + 1;
  const best = attempts.length ? Math.max(...attempts.map((a) => a.scores.overall)) : null;
  const start = () => {
    if (!exhausted) onStart({ difficulty, hints });
  };

  return (
    <AppShell
      product={product}
      items={[
        { id: "home", label: "Practice home", icon: "home", current: true, onSelect: () => {} },
        ...(last
          ? [
              {
                id: "report",
                label: "Your latest report",
                icon: "report",
                onSelect: () => onViewReport(last),
              },
            ]
          : []),
      ]}
    >
      <div className="md:h-full flex flex-col gap-2.5 p-2.5 lg:gap-3 lg:p-3 lg:short:gap-2.5 lg:short:p-2.5">
        {/* Header strip: what this is, its terms, and the game layer at a glance */}
        <header className="card flex-none flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <div className="min-w-0 mr-auto">
            <p className="hidden lg:block t-small text-ink/80">
              Practice <span aria-hidden>/</span> {scenario.category}
            </p>
            <h1 className="text-lg xl:text-xl font-bold tracking-tight text-ink leading-tight">
              The Renewal with {persona.name}
            </h1>
            <ul
              className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 t-small text-ink/85"
              aria-label="Terms"
            >
              <li className="lg:hidden">Practice, {scenario.category}</li>
              <li className="flex items-center gap-1.5">
                <Icon name="clock" size={15} /> About {minutes} min
              </li>
              <li className="flex items-center gap-1.5">
                <Icon name="attempts" size={15} />
                {exhausted ? `All ${maxRuns} runs used` : `${runsLeft} of ${maxRuns} runs left`}
              </li>
            </ul>
          </div>
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Your progress">
            <div className="flex items-center gap-1.5">
              <FlameGlyph size={18} className="text-[var(--accent-ui)]" />
              <dt className="sr-only">Day streak</dt>
              <dd className="text-sm font-bold text-ink tabular-nums">
                {streak} <span className="font-medium text-ink/80">{streak === 1 ? "day" : "days"}</span>
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <StarGlyph size={18} className="text-[var(--xp)]" />
              <dt className="sr-only">Total XP</dt>
              <dd className="text-sm font-bold text-ink tabular-nums">
                {xp} <span className="font-medium text-ink/80">XP</span>
              </dd>
            </div>
            <div className="w-28 xl:w-32">
              <dt className="flex justify-between t-small text-ink/80">
                <span>
                  Level <span className="font-semibold text-ink">{level.name}</span>
                </span>
              </dt>
              <dd className="mt-1">
                <Bar
                  value={levelProgress(xp)}
                  max={100}
                  label={nextLevel ? `${nextLevel.floor - xp} XP to ${nextLevel.name}` : "Top level reached"}
                  color="var(--accent-ui)"
                />
              </dd>
            </div>
            <div className="w-28 xl:w-32">
              <dt className="flex justify-between t-small text-ink/80">
                Daily goal
                <span className="tabular-nums">
                  {Math.min(today, DAILY_GOAL_XP)}/{DAILY_GOAL_XP}
                </span>
              </dt>
              <dd className="mt-1">
                <Bar value={today} max={DAILY_GOAL_XP} label="Daily goal in XP" color="var(--xp)" />
              </dd>
            </div>
            <div>
              <dt className="sr-only">This week</dt>
              <dd>
                <ul className="flex gap-1" aria-label="Practice days this week">
                  {week.map((d) => (
                    <li key={d.label} className="flex flex-col items-center">
                      <span
                        aria-hidden
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={
                          d.done
                            ? { background: "var(--accent-ui)", color: "#fff" }
                            : d.today
                              ? { border: "2px solid var(--accent-ui)" }
                              : { border: "1.5px solid var(--line)" }
                        }
                      >
                        {d.done && <Icon name="check" size={11} stroke={3.2} />}
                      </span>
                      <span
                        className={`text-xs ${d.today ? "font-bold text-ink" : "text-ink/80"}`}
                        aria-hidden
                      >
                        {d.short}
                      </span>
                      <span className="sr-only">
                        {d.label}
                        {d.today ? ", today" : ""}: {d.done ? "practised" : "no run yet"}
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </header>

        <main className="flex-1 min-h-0 flex flex-col gap-2.5 lg:gap-3 lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)_minmax(0,0.92fr)]">
          {/* Situation: who you meet, where, and what you are there to do */}
          <section
            className="card p-3 lg:p-4 lg:short:p-3 min-h-0 flex-none grid gap-x-5 gap-y-2 xl:gap-y-2.5 md:grid-cols-2 lg:flex lg:flex-col"
            aria-labelledby="situation-heading"
          >
            <h2 id="situation-heading" className="sr-only">
              The situation
            </h2>
            <div className="flex flex-col gap-2 xl:gap-2.5">
              <div className="flex items-center gap-3">
                <figure
                  className="relative w-16 xl:w-[72px] lg:short:w-14 aspect-square flex-none overflow-hidden rounded-[var(--radius-sm)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  <img
                    src={PORTRAIT_SRC}
                    alt={persona.portraitAlt}
                    className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
                  />
                </figure>
                <div className="min-w-0">
                  <p className="t-small text-ink/80">You are meeting</p>
                  <p className="text-base font-bold text-ink leading-tight">{persona.name}</p>
                  <p className="t-small text-ink/85">
                    {persona.role}, {persona.organisation}
                  </p>
                </div>
              </div>
              <p
                className="t-body text-ink font-semibold px-3 py-2 rounded-[var(--radius-sm)]"
                style={{ background: "var(--accent-soft)" }}
              >
                <span className="block t-small font-semibold text-[var(--accent-soft-ink)] mb-0.5">
                  The challenge
                </span>
                {player.challenge}
              </p>
              <Block title="The scene">
                <p className="t-body text-ink/90">{player.scene}</p>
              </Block>
            </div>
            <div className="flex flex-col gap-2 xl:gap-2.5 lg:flex-1">
              <Block title="Your role">
                <p className="t-body text-ink/90">{player.role}</p>
              </Block>
              <Block title="Your goal">
                <p className="t-body text-ink/90">{player.goal}</p>
              </Block>
              <p className="mt-auto pt-1 t-small text-ink/80">
                The behaviours behind each skill appear in the call when you press What counts. Feedback
                status: rung {scenario.instrument.claimRung} of 4, {rung.title.toLowerCase()}. {rung.fitFor}
              </p>
            </div>
          </section>

          {/* What you are scored on */}
          <section
            className="card p-3 lg:p-4 lg:short:p-3 min-h-0 flex-none flex flex-col gap-2.5 md:block md:columns-2 md:gap-x-5 lg:flex lg:columns-1 [&>*+*]:md:mt-2.5 [&>*+*]:lg:mt-0"
            aria-labelledby="scoring-heading"
          >
            <h2 id="scoring-heading" className="sr-only">
              What you are scored on
            </h2>
            <Block
              className="break-inside-avoid"
              title="Objectives"
              aside={`${scenario.instrument.objectives.length} to complete`}
            >
              <ol className="flex flex-col gap-1.5">
                {scenario.instrument.objectives.map((o, i) => (
                  <li key={o.id} className="flex items-start gap-2.5">
                    <span className="chip w-6 h-6 min-h-0 flex-none justify-center px-0 font-bold">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0 t-body">
                      <span className="font-semibold text-ink">{o.label}</span>
                      <span className="text-ink/85">: {o.sub}</span>
                    </span>
                    <span className="t-small font-semibold text-brand whitespace-nowrap">+{o.xp} XP</span>
                  </li>
                ))}
              </ol>
            </Block>
            <Block title="Skills" aside="Weight">
              <ul className="flex flex-col gap-1.5">
                {scenario.instrument.skills.map((sk) => (
                  <li key={sk.id} className="break-inside-avoid">
                    <p className="flex items-baseline justify-between gap-2 t-body font-semibold text-ink leading-tight">
                      {sk.name}
                      <span className="t-small font-medium text-ink/80 tabular-nums">{sk.weight}%</span>
                    </p>
                    <p className="t-small text-ink/80">{sk.desc}</p>
                  </li>
                ))}
              </ul>
            </Block>
          </section>

          {/* The run you are about to start, and your path so far */}
          <section
            className="card p-3 lg:p-4 lg:short:p-3 flex flex-col gap-2.5 xl:gap-3 lg:short:!gap-2 min-h-0 flex-none max-md:order-first md:grid md:grid-cols-2 md:gap-x-5 lg:flex"
            aria-labelledby="setup-heading"
          >
            <div className="flex flex-col gap-2">
              <h2 id="setup-heading" className="text-base font-bold text-ink leading-tight">
                {exhausted ? "Practice complete" : `Set up run ${runNo}`}
              </h2>
              <div role="radiogroup" aria-label="Persona difficulty" className="grid grid-cols-3 gap-1.5">
                {DIFFICULTIES.map((d) => {
                  const on = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setDifficulty(d.id)}
                      className="choice text-left px-2.5 py-2 min-h-[44px] flex flex-col gap-0.5"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="w-4 h-4 flex-none rounded-full flex items-center justify-center"
                          style={
                            on
                              ? { background: "var(--accent)", color: "#fff" }
                              : { border: "1.5px solid var(--line)" }
                          }
                        >
                          {on && <Icon name="check" size={10} stroke={3.2} />}
                        </span>
                        <span className="font-semibold text-ink t-body">{d.label}</span>
                      </span>
                      <span className="block text-ink/80 t-small">{d.desc}</span>
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2.5 t-body text-ink cursor-pointer min-h-[28px]">
                <input
                  type="checkbox"
                  checked={hints}
                  onChange={(e) => setHints(e.target.checked)}
                  className="w-5 h-5 flex-none accent-[var(--accent)]"
                />
                Hint me when a reply misses an opportunity
              </label>
              <button onClick={start} disabled={exhausted} className="btn btn-primary w-full">
                {exhausted ? `All ${maxRuns} runs used` : `Start run ${runNo}`}
                {!exhausted && <Icon name="arrow" size={18} />}
              </button>
            </div>

            <div className="flex flex-col gap-2.5 xl:gap-3 lg:short:!gap-2 md:col-start-2 md:row-start-1 md:row-span-2">
              <Block
                title="Your path"
                aside={best === null ? "First run sets your baseline" : `Best ${best}/10`}
              >
                <ol className="grid" style={{ gridTemplateColumns: `repeat(${maxRuns}, minmax(0, 1fr))` }}>
                  {Array.from({ length: maxRuns }, (_, i) => {
                    const r = attempts[i];
                    const current = !r && i === attempts.length && !exhausted;
                    const passed = r ? r.scores.overall >= scenario.passScore : false;
                    const node =
                      "relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold";
                    return (
                      <li key={i} className="relative flex flex-col items-center text-center">
                        {i > 0 && (
                          <span
                            aria-hidden
                            className="absolute top-[18px] right-1/2 w-full h-1 -translate-y-1/2 rounded-full"
                            style={{ background: r || current ? "var(--accent-ui)" : "var(--edge)" }}
                          />
                        )}
                        {r ? (
                          <button
                            onClick={() => onViewReport(r)}
                            aria-label={`Run ${i + 1}, scored ${r.scores.overall} of 10. Open its report`}
                            className={`${node} text-white`}
                            style={{ background: passed ? "var(--ok)" : "var(--accent)" }}
                          >
                            <Icon name="check" size={16} stroke={3} />
                          </button>
                        ) : (
                          <span
                            className={node}
                            style={
                              current
                                ? {
                                    background: "var(--surface)",
                                    border: "3px solid var(--accent-ui)",
                                    color: "var(--brand)",
                                  }
                                : {
                                    background: "var(--surface-2)",
                                    border: "1.5px solid var(--line)",
                                    color: "rgb(var(--ink) / 0.8)",
                                  }
                            }
                          >
                            {current ? <Icon name="play" size={14} filled /> : <Icon name="lock" size={14} />}
                          </span>
                        )}
                        <span
                          className={`mt-1 text-xs leading-tight ${current ? "font-bold text-brand" : "text-ink/80"}`}
                        >
                          {r ? `${r.scores.overall}/10` : current ? "Up next" : `Run ${i + 1}`}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </Block>

              <Block title="Quests this week">
                <ul className="flex flex-col gap-1.5">
                  {quests.map((q) => {
                    const done = q.progress >= q.target;
                    return (
                      <li key={q.id}>
                        <div className="flex justify-between gap-3 t-small">
                          <span className="text-ink flex items-center gap-1.5">
                            {done && <Icon name="check" size={14} stroke={3} className="text-[var(--ok)]" />}
                            {q.label}
                          </span>
                          <span className="text-ink/80 tabular-nums">
                            {q.progress}/{q.target}
                          </span>
                        </div>
                        <div className="mt-1">
                          <Bar
                            value={q.progress}
                            max={q.target}
                            label={q.label}
                            color={done ? "var(--ok)" : "var(--accent-ui)"}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Block>
            </div>
            <div className="md:col-start-1 lg:order-last">
              <Block title="Badges" aside={`${earned.size} of ${BADGES.length}`}>
                <ul className="grid grid-cols-6 gap-1">
                  {BADGES.map((b) => {
                    const got = earned.has(b.id);
                    return (
                      <li key={b.id} className="flex flex-col items-center text-center">
                        <BadgeMedal mark={b.mark} earned={got} size={30} />
                        <span
                          className={`mt-0.5 text-xs leading-tight ${got ? "font-semibold text-ink" : "text-ink/80"}`}
                        >
                          {b.name}
                        </span>
                        <span className="sr-only">
                          , {got ? "earned" : "not earned yet"}. {b.desc}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Block>
            </div>
          </section>
        </main>
      </div>
    </AppShell>
  );
}

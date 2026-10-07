import { useState } from "react";
import AppShell from "../components/AppShell";
import Icon, { FlameGlyph, StarGlyph } from "../components/Icon";
import Tabs, { tabPanelProps } from "../components/Tabs";
import BadgeMedal from "../components/BadgeMedal";
import BuildStamp from "../components/BuildStamp";
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

type DetailTab = "brief" | "skills" | "objectives";

// AI RolePlay home: a practice studio. The left column is the decision (who you will meet, how
// hard, start); the right column holds the scenario details and the game layer. Streak, daily goal,
// level, quests and badges come only from saved runs, so a first time learner starts at zero.
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
  const [tab, setTab] = useState<DetailTab>("brief");
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
  const startLabel = exhausted ? `All ${maxRuns} runs used` : `Start run ${runNo}`;
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
      <div className="max-w-[1480px] p-3 sm:p-4 lg:p-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px] items-start">
        <main className="flex flex-col gap-4 min-w-0">
          {/* Header card */}
          <section className="card p-5 sm:p-6" aria-labelledby="scenario-title">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink/80">
                <li>Practice</li>
                <li aria-hidden>/</li>
                <li>{scenario.category}</li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-ink font-medium">
                  Renewal
                </li>
              </ol>
            </nav>
            <h1 id="scenario-title" className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              The Renewal with {persona.name}
            </h1>
            <ul
              className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/85"
              aria-label="About this scenario"
            >
              <li className="flex items-center gap-1.5">
                <Icon name="clock" size={17} /> About {minutes} min
              </li>
              <li className="flex items-center gap-1.5">
                <Icon name="user" size={17} /> {persona.role}, {persona.organisation}
              </li>
              <li className="flex items-center gap-1.5">
                <Icon name="attempts" size={17} />
                {exhausted ? `All ${maxRuns} runs used` : `${runsLeft} of ${maxRuns} runs left`}
              </li>
              <li className="flex items-center gap-1.5">
                <Icon name="target" size={17} /> {scenario.instrument.objectives.length} objectives
              </li>
            </ul>
            <div className="mt-4 hidden sm:flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink/85 mr-1">Skills</span>
              {scenario.instrument.skills.map((sk) => (
                <span key={sk.id} className="chip">
                  {sk.name}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-ink/85 max-w-3xl">{player.challenge}</p>
          </section>

          {/* Stage: who you will meet and how hard */}
          <section className="card p-4 sm:p-5" aria-labelledby="setup-heading">
            <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <figure className="relative aspect-square w-28 md:w-full overflow-hidden rounded-[var(--radius-sm)]">
                <img
                  src={PORTRAIT_SRC}
                  alt={persona.portraitAlt}
                  className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
                  style={{ background: "var(--surface-2)" }}
                />
                <figcaption
                  className="absolute left-3 top-3 hidden md:flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white"
                  style={{ background: "rgb(15 15 18 / 0.72)" }}
                >
                  <span aria-hidden className="w-2 h-2 rounded-full bg-white" />
                  {persona.name}
                </figcaption>
              </figure>

              <div className="flex flex-col gap-4 min-w-0">
                <div>
                  <h2 id="setup-heading" className="text-xl font-bold text-ink">
                    {exhausted ? "Practice complete" : `Set up run ${runNo}`}
                  </h2>
                  <p className="text-sm text-ink/80 mt-1">
                    Pick how hard {persona.name.split(" ")[0]} pushes back. Your score always uses the same
                    skills.
                  </p>
                </div>
                <fieldset>
                  <legend className="text-sm font-semibold text-ink mb-2">Persona difficulty</legend>
                  <div
                    role="radiogroup"
                    aria-label="Persona difficulty"
                    className="grid gap-2 sm:grid-cols-3"
                  >
                    {DIFFICULTIES.map((d) => {
                      const on = difficulty === d.id;
                      return (
                        <button
                          key={d.id}
                          role="radio"
                          aria-checked={on}
                          onClick={() => setDifficulty(d.id)}
                          className="choice text-left px-3 py-2.5 min-h-[44px] flex items-start gap-2"
                        >
                          <span
                            aria-hidden
                            className="mt-0.5 w-5 h-5 flex-none rounded-full flex items-center justify-center"
                            style={
                              on
                                ? { background: "var(--accent)", color: "#fff" }
                                : { border: "1.5px solid var(--line)" }
                            }
                          >
                            {on && <Icon name="check" size={12} stroke={3} />}
                          </span>
                          <span>
                            <span className="block font-semibold text-ink text-sm">{d.label}</span>
                            <span className="hidden sm:block text-ink/80 text-xs leading-snug mt-0.5">
                              {d.desc}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <label className="inline-flex items-center gap-2.5 text-sm text-ink cursor-pointer self-start min-h-[24px]">
                  <input
                    type="checkbox"
                    checked={hints}
                    onChange={(e) => setHints(e.target.checked)}
                    className="w-5 h-5 accent-[var(--accent)]"
                  />
                  Show a hint when a reply misses an opportunity
                </label>
                <div className="flex flex-wrap items-center gap-3 mt-auto">
                  <button onClick={start} disabled={exhausted} className="btn btn-primary px-6">
                    {startLabel}
                    {!exhausted && <Icon name="arrow" size={18} />}
                  </button>
                  <span className="text-sm text-ink/80">Every run is saved to your path.</span>
                </div>
              </div>
            </div>

            {/* The path of runs, drawn like a progress track */}
            <div className="mt-6 pt-5 border-t" style={{ borderColor: "var(--edge)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-base font-bold text-ink">Your path</h2>
                <p className="text-sm text-ink/80">
                  {attempts.length === 0
                    ? "Your first run sets your baseline."
                    : `${attempts.length} of ${maxRuns} runs. Best ${Math.max(...attempts.map((a) => a.scores.overall))}/10.`}
                </p>
              </div>
              <ol className="mt-4 grid" style={{ gridTemplateColumns: `repeat(${maxRuns}, minmax(0, 1fr))` }}>
                {Array.from({ length: maxRuns }, (_, i) => {
                  const r = attempts[i];
                  const current = !r && i === attempts.length && !exhausted;
                  const passed = r ? r.scores.overall >= scenario.passScore : false;
                  const node =
                    "relative z-10 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold";
                  return (
                    <li key={i} className="relative flex flex-col items-center text-center">
                      {i > 0 && (
                        <span
                          aria-hidden
                          className="absolute top-[22px] right-1/2 w-full h-1.5 -translate-y-1/2 rounded-full"
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
                          <Icon name="check" size={18} stroke={3} />
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
                          {current ? <Icon name="play" size={16} filled /> : <Icon name="lock" size={16} />}
                        </span>
                      )}
                      <span
                        className={`mt-2 text-xs leading-tight ${current ? "font-bold text-brand" : "text-ink/80"}`}
                      >
                        {r ? `Run ${i + 1} · ${r.scores.overall}/10` : current ? "Up next" : `Run ${i + 1}`}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        </main>

        <aside className="flex flex-col gap-4 min-w-0" aria-label="Scenario details and progress">
          {/* Scenario details */}
          <section className="card p-5" aria-labelledby="details-heading">
            <h2 id="details-heading" className="text-xl font-bold text-ink mb-4">
              Scenario details
            </h2>
            <Tabs
              label="Scenario details"
              idPrefix="details"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "brief", label: "Brief" },
                { id: "skills", label: "Skills" },
                { id: "objectives", label: "Objectives" },
              ]}
            />
            <div className="mt-4">
              {tab === "brief" && (
                <div
                  {...tabPanelProps("details", "brief")}
                  className="flex flex-col gap-2 rounded-[var(--radius-sm)]"
                >
                  {[
                    { t: "The scene", body: player.scene, open: true },
                    { t: "Your role", body: player.role },
                    { t: "Your goal", body: player.goal },
                    { t: "The challenge", body: player.challenge },
                  ].map((b) => (
                    <details key={b.t} className="acc" open={b.open}>
                      <summary>
                        {b.t}
                        <Icon name="chevron" size={18} className="acc-chevron" />
                      </summary>
                      <p className="acc-body text-sm leading-relaxed text-ink/85">{b.body}</p>
                    </details>
                  ))}
                </div>
              )}
              {tab === "skills" && (
                <div
                  {...tabPanelProps("details", "skills")}
                  className="flex flex-col gap-2 rounded-[var(--radius-sm)]"
                >
                  <p className="text-sm text-ink/80 mb-1">
                    In practice the criteria are yours to see. Each behaviour has written anchors for Strong,
                    Adequate, Weak and Harmful.
                  </p>
                  {scenario.instrument.skills.map((sk) => (
                    <details key={sk.id} className="acc">
                      <summary>
                        <span>
                          {sk.name} <span className="font-normal text-ink/80">· {sk.weight}%</span>
                        </span>
                        <Icon name="chevron" size={18} className="acc-chevron" />
                      </summary>
                      <div className="acc-body">
                        <p className="text-sm text-ink/85 leading-relaxed">{sk.desc}</p>
                        <ul className="mt-2 space-y-1">
                          {sk.indicators.map((ind) => (
                            <li key={ind.id} className="text-sm text-ink/85 flex gap-2">
                              <span
                                aria-hidden
                                className="mt-2 w-1.5 h-1.5 rounded-full flex-none"
                                style={{ background: "var(--accent-ui)" }}
                              />
                              {ind.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ))}
                </div>
              )}
              {tab === "objectives" && (
                <div {...tabPanelProps("details", "objectives")} className="rounded-[var(--radius-sm)]">
                  <ol className="flex flex-col gap-2">
                    {scenario.instrument.objectives.map((o, i) => (
                      <li key={o.id} className="acc px-4 py-3 flex items-start gap-3">
                        <span className="chip w-7 h-7 flex-none justify-center px-0 font-bold">{i + 1}</span>
                        <span className="flex-1">
                          <span className="block font-semibold text-ink text-sm">{o.label}</span>
                          <span className="block text-sm text-ink/80">{o.sub}</span>
                        </span>
                        <span className="text-sm font-semibold text-brand whitespace-nowrap">+{o.xp} XP</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <p className="mt-4 text-xs text-ink/80 leading-relaxed">
              Feedback status: rung {scenario.instrument.claimRung} of 4, {rung.title.toLowerCase()}.{" "}
              {rung.fitFor}
            </p>
          </section>

          {/* Game layer */}
          <section className="card p-5" aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="text-xl font-bold text-ink">
              Your progress
            </h2>
            <dl className="mt-4 grid grid-cols-3 gap-2">
              <div className="acc px-3 py-3">
                <dt className="text-xs text-ink/80">Streak</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold text-ink">
                  <FlameGlyph size={20} className="text-[var(--accent-ui)]" />
                  {streak} {streak === 1 ? "day" : "days"}
                </dd>
              </div>
              <div className="acc px-3 py-3">
                <dt className="text-xs text-ink/80">Total XP</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-lg font-bold text-ink tabular-nums">
                  <StarGlyph size={20} className="text-[var(--xp)]" />
                  {xp}
                </dd>
              </div>
              <div className="acc px-3 py-3">
                <dt className="text-xs text-ink/80">Level</dt>
                <dd className="mt-1 text-lg font-bold text-ink leading-tight">{level.name}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink/80">
              {nextLevel ? `${nextLevel.floor - xp} XP to ${nextLevel.name}` : "Top level reached"}
            </p>
            <div
              className="mt-1.5 h-2 rounded-full overflow-hidden"
              style={{ background: "var(--edge)" }}
              role="progressbar"
              aria-label="Progress to the next level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(levelProgress(xp))}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${levelProgress(xp)}%`, background: "var(--accent-ui)" }}
              />
            </div>

            <h3 className="mt-6 text-base font-bold text-ink flex items-baseline justify-between">
              Daily goal
              <span className="text-sm font-medium text-ink/80 tabular-nums">
                {Math.min(today, DAILY_GOAL_XP)} of {DAILY_GOAL_XP} XP
              </span>
            </h3>
            <div
              className="mt-2 h-2 rounded-full overflow-hidden"
              style={{ background: "var(--edge)" }}
              role="progressbar"
              aria-label="Daily goal"
              aria-valuemin={0}
              aria-valuemax={DAILY_GOAL_XP}
              aria-valuenow={Math.min(today, DAILY_GOAL_XP)}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, (today / DAILY_GOAL_XP) * 100)}%`, background: "var(--xp)" }}
              />
            </div>
            <ul className="mt-3 grid grid-cols-7 gap-1" aria-label="Practice days this week">
              {week.map((d) => (
                <li key={d.label} className="flex flex-col items-center gap-1">
                  <span
                    aria-hidden
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={
                      d.done
                        ? { background: "var(--accent-ui)", color: "#fff" }
                        : d.today
                          ? { border: "2px solid var(--accent-ui)" }
                          : { background: "var(--surface-2)", border: "1px solid var(--edge)" }
                    }
                  >
                    {d.done && <Icon name="check" size={14} stroke={3} />}
                  </span>
                  <span className={`text-xs ${d.today ? "font-bold text-ink" : "text-ink/80"}`} aria-hidden>
                    {d.short}
                  </span>
                  <span className="sr-only">
                    {d.label}
                    {d.today ? ", today" : ""}: {d.done ? "practised" : "no run yet"}
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-base font-bold text-ink">Quests this week</h3>
            <ul className="mt-2 flex flex-col gap-3">
              {quests.map((q) => {
                const done = q.progress >= q.target;
                return (
                  <li key={q.id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-ink flex items-center gap-1.5">
                        {done && <Icon name="check" size={15} stroke={3} className="text-[var(--ok)]" />}
                        {q.label}
                      </span>
                      <span className="text-ink/80 tabular-nums">
                        {q.progress}/{q.target}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2 rounded-full overflow-hidden"
                      style={{ background: "var(--edge)" }}
                      role="progressbar"
                      aria-label={q.label}
                      aria-valuemin={0}
                      aria-valuemax={q.target}
                      aria-valuenow={q.progress}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(q.progress / q.target) * 100}%`,
                          background: done ? "var(--ok)" : "var(--accent-ui)",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <h3 className="mt-6 text-base font-bold text-ink flex items-baseline justify-between">
              Badges
              <span className="text-sm font-medium text-ink/80 tabular-nums">
                {earned.size} of {BADGES.length}
              </span>
            </h3>
            <ul className="mt-3 grid grid-cols-6 gap-2">
              {BADGES.map((b) => (
                <li key={b.id} className="flex flex-col items-center" title={`${b.name}: ${b.desc}`}>
                  <BadgeMedal mark={b.mark} earned={earned.has(b.id)} size={40} />
                  <span className="sr-only">
                    {b.name}, {earned.has(b.id) ? "earned" : "not earned yet"}. {b.desc}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <BuildStamp product={product.name} />
    </AppShell>
  );
}

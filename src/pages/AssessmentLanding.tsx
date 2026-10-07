import { useEffect, useRef, useState, type ReactNode } from "react";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import DeviceCheck from "../components/DeviceCheck";
import BuildStamp from "../components/BuildStamp";
import { PORTRAIT_SRC } from "../data/scenario";
import type { Report } from "../domain/report";
import type { Scenario } from "../domain/scenario";
import type { Product } from "../products";
import useMediaQuery from "../lib/useMediaQuery";

// One numbered section of the brief: a mono index, a heading and its text, like a printed paper.
function BriefRow({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section
      className="grid grid-cols-[2.5rem_1fr] sm:grid-cols-[3.5rem_1fr] gap-x-3 py-5 border-t first:border-t-0"
      style={{ borderColor: "var(--edge)" }}
    >
      <span className="text-sm text-brand pt-0.5 tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="font-display font-semibold text-ink text-lg leading-tight mb-1.5">{title}</h2>
        {children}
      </div>
    </section>
  );
}

// Conversation AI home: the assessment brief. The same frame as AI RolePlay (rail, grey ground, white
// cards) in a quieter, formal register: a header card with the terms, three steps, the brief as a
// numbered paper, instructions with a device check, and a begin card. No game layer, no hints, no
// indicators shown before the call.
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
  const xlUp = useMediaQuery("(min-width: 1280px)");
  // Below xl the begin card sits after the brief, so a sticky bar carries the next step until the
  // card itself is on screen.
  const beginRef = useRef<HTMLElement | null>(null);
  const [beginVisible, setBeginVisible] = useState(false);
  useEffect(() => {
    const el = beginRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setBeginVisible(entry.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const goToBegin = () => {
    beginRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => document.getElementById("confirm-begin")?.focus({ preventScroll: true }), 350);
  };
  const minutes = Math.round(scenario.durationSeconds / 60);
  const persona = scenario.stimulus.persona;
  const player = scenario.stimulus.player;
  const pilot = scenario.instrument.claimRung === 1;

  const INSTRUCTIONS = [
    `Find a quiet place and allow the full ${minutes} minutes in one sitting.`,
    "Test your microphone and camera. Both are optional; you can type every reply.",
    `Speak or type to ${persona.name.split(" ")[0]} as you would in a real call. Only your transcript is scored.`,
    "You have one attempt. The call ends when you end it or when the time runs out, and the report is saved.",
    "Tick the confirmation, then press Begin the assessment.",
  ];

  const STEPS = [
    { href: "#brief", label: "Read the brief", short: "Brief", done: false },
    { href: "#devices", label: "Check your devices", short: "Devices", done: false },
    { href: "#begin", label: "Confirm and begin", short: "Begin", done: confirmed },
  ];

  return (
    <AppShell
      product={product}
      items={[
        { id: "brief", label: "Assessment brief", icon: "brief", current: true, onSelect: () => {} },
        ...(completed
          ? [
              {
                id: "report",
                label: "Your assessment report",
                icon: "report",
                onSelect: () => onViewReport(completed),
              },
            ]
          : []),
      ]}
    >
      <div
        className={`max-w-[1480px] p-3 sm:p-4 lg:p-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] items-start ${xlUp ? "" : "pb-28"}`}
      >
        <main className="flex flex-col gap-4 min-w-0">
          {/* Header card: what this is and its terms */}
          <section className="card p-5 sm:p-6" aria-labelledby="assessment-title">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-sm text-ink/80">
                <li>Assessments</li>
                <li aria-hidden>/</li>
                <li aria-current="page" className="text-ink font-medium">
                  {scenario.category}
                </li>
              </ol>
            </nav>
            <h1
              id="assessment-title"
              className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-ink leading-tight"
            >
              {scenario.title}
            </h1>
            <ul
              className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/85"
              aria-label="Terms of this assessment"
            >
              <li className="flex items-center gap-1.5">
                <Icon name="clock" size={17} /> {minutes} min time limit
              </li>
              <li className="flex items-center gap-1.5">
                <Icon name="attempts" size={17} /> One attempt
              </li>
              <li className="flex items-center gap-1.5">
                <Icon name="target" size={17} /> Pass mark {scenario.passScore}/10
              </li>
              <li className="flex items-center gap-1.5">
                <Icon name="layers" size={17} /> {scenario.instrument.skills.length} skills
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="chip">Assessment</span>
              {pilot && <span className="chip chip-neutral">Pilot assessment, feedback only</span>}
            </div>
            <p className="mt-4 text-[15px] leading-relaxed text-ink/85 max-w-3xl">
              {product.tagline} One conversation with {persona.name}, {persona.role} at {persona.organisation}
              .
            </p>
          </section>

          {/* Three steps, in order. Each links to its part of the page; the last fills in once confirmed. */}
          {!completed && (
            <nav aria-label="Steps before you begin">
              <ol className="grid grid-cols-3 gap-2 sm:gap-3">
                {STEPS.map((st, i) => (
                  <li key={st.href}>
                    <a
                      href={st.href}
                      className="card flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-3 h-full hover:bg-[var(--surface-2)]"
                      style={st.done ? { borderColor: "var(--accent-ui)" } : undefined}
                    >
                      <span
                        className="w-7 h-7 flex-none rounded-full flex items-center justify-center text-sm font-semibold tabular-nums"
                        style={
                          st.done
                            ? { background: "var(--accent)", color: "#ffffff" }
                            : { border: "1.5px solid var(--line)", color: "rgb(var(--ink))" }
                        }
                      >
                        {st.done ? <Icon name="check" size={13} stroke={2.6} /> : i + 1}
                      </span>
                      <span className="text-sm font-medium text-ink leading-tight">
                        <span className="sm:hidden">{st.short}</span>
                        <span className="hidden sm:inline">{st.label}</span>
                        {st.done && <span className="sr-only"> (done)</span>}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* The brief, as a numbered paper */}
          <article id="brief" className="card px-5 sm:px-7 py-2 scroll-mt-4" aria-label="Assessment brief">
            <BriefRow n="01" title="The scene">
              <p className="text-ink/85 text-[15px] leading-relaxed">{player.scene}</p>
            </BriefRow>
            <BriefRow n="02" title="Your role">
              <p className="text-ink/85 text-[15px] leading-relaxed">{player.role}</p>
            </BriefRow>
            <BriefRow n="03" title="Your goal">
              <p className="text-ink/85 text-[15px] leading-relaxed">{player.goal}</p>
            </BriefRow>
            <BriefRow n="04" title="The challenge">
              <p className="text-ink/85 text-[15px] leading-relaxed">{player.challenge}</p>
              <p className="mt-3 text-sm font-semibold text-ink">Objectives to achieve</p>
              <ol className="mt-1.5 space-y-1.5">
                {scenario.instrument.objectives.map((o, i) => (
                  <li key={o.id} className="grid grid-cols-[1.5rem_1fr] gap-x-1 text-sm leading-snug">
                    <span className="text-ink/75 tabular-nums">{i + 1}.</span>
                    <span>
                      <span className="font-semibold text-ink">{o.label}</span>
                      <span className="text-ink/80">: {o.sub}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </BriefRow>
          </article>

          {/* Instructions and the device check */}
          <section className="card p-5 sm:p-6" aria-labelledby="instructions-heading">
            <div className="grid lg:grid-cols-2 gap-x-8 gap-y-5">
              <div>
                <h2 id="instructions-heading" className="font-display font-semibold text-ink text-lg mb-3">
                  Instructions
                </h2>
                <ol className="space-y-2">
                  {INSTRUCTIONS.map((t, i) => (
                    <li key={t} className="grid grid-cols-[1.5rem_1fr] gap-x-1">
                      <span className="text-ink/75 text-sm tabular-nums">{i + 1}.</span>
                      <span className="text-ink/85 text-sm leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ol>
                <p
                  className="mt-4 text-ink/85 text-sm leading-relaxed p-3 rounded-[var(--radius-sm)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  Need more time? Extended time is available on request from your administrator.
                </p>
              </div>
              <div id="devices" className="scroll-mt-4">
                <h3 className="font-display font-semibold text-ink text-lg mb-1">
                  Audio and video access test
                </h3>
                <p className="text-ink/75 text-sm leading-relaxed mb-1">
                  Check that your browser can reach your microphone and camera before you begin.
                </p>
                <DeviceCheck />
              </div>
            </div>
          </section>
        </main>

        <aside className="flex flex-col gap-4 min-w-0">
          {/* Counterpart: a 1:1 portrait with a name pill */}
          <section className="card p-3" aria-label="Your counterpart">
            <div className="grid grid-cols-[112px_1fr] sm:grid-cols-[136px_1fr] gap-4 items-center">
              <figure
                className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)]"
                style={{ background: "var(--surface-2)" }}
              >
                <img
                  src={PORTRAIT_SRC}
                  alt={persona.portraitAlt}
                  className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
                />
              </figure>
              <div className="min-w-0">
                <p className="text-ink/75 text-sm">Your counterpart</p>
                <p className="font-display font-semibold text-ink text-lg leading-tight">{persona.name}</p>
                <p className="text-ink/80 text-sm mt-0.5">
                  {persona.role}, {persona.organisation}
                </p>
              </div>
            </div>
          </section>

          {/* Begin */}
          <section
            id="begin"
            ref={beginRef}
            className="card p-5 scroll-mt-4"
            style={{ borderColor: "var(--accent-ui)", borderWidth: 2 }}
            aria-labelledby="begin-heading"
          >
            {completed ? (
              <>
                <h2 id="begin-heading" className="font-display font-semibold text-ink text-lg mb-2">
                  Assessment complete
                </h2>
                <p className="text-ink/85 text-sm leading-relaxed mb-4">
                  Taken on{" "}
                  {new Date(completed.completedAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                  . Score <span className="font-semibold text-ink">{completed.scores.overall}/10</span>. The
                  one attempt has been used; the report is saved under {completed.id}.
                </p>
                <button onClick={() => onViewReport(completed)} className="w-full btn btn-primary">
                  Open the report
                </button>
              </>
            ) : (
              <>
                <h2 id="begin-heading" className="font-display font-semibold text-ink text-lg mb-3">
                  Before you begin
                </h2>
                <label className="flex items-start gap-3 text-sm text-ink/85 cursor-pointer mb-4">
                  <input
                    id="confirm-begin"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 w-5 h-5 flex-none accent-[var(--accent)]"
                  />
                  <span>
                    I have read the brief and the instructions. I understand this is a single, timed attempt
                    and that the report will be saved.
                  </span>
                </label>
                <button onClick={onBegin} disabled={!confirmed} className="w-full btn btn-primary">
                  Begin the assessment
                </button>
                <p className="text-ink/75 text-sm mt-3 leading-relaxed">
                  {minutes} minutes, one sitting. Find a quiet place and allow the full time.
                </p>
              </>
            )}
          </section>

          {/* Skills mapped: names and one liners only; the indicators stay hidden until the report */}
          <section className="card p-5" aria-labelledby="skills-mapped-heading">
            <h2 id="skills-mapped-heading" className="font-display font-semibold text-ink text-lg mb-3">
              Skills mapped
            </h2>
            <ul className="space-y-3">
              {scenario.instrument.skills.map((sk, i) => (
                <li key={sk.id} className="grid grid-cols-[2rem_1fr] gap-x-1">
                  <span
                    className="text-brand text-sm tabular-nums pt-px"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block font-semibold text-ink text-[15px] leading-snug">{sk.name}</span>
                    <span className="block text-ink/80 text-sm leading-relaxed">{sk.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <BuildStamp product={product.name} />

      {!xlUp && !beginVisible && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 flex items-center gap-3"
          style={{
            background: "var(--surface)",
            borderColor: "var(--edge)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <p className="flex-1 min-w-0 text-ink/80 text-sm leading-snug">
            {completed ? "Your one attempt is complete." : `${minutes} minutes, one attempt.`}
          </p>
          <button
            onClick={() => (completed ? onViewReport(completed) : goToBegin())}
            className="btn btn-primary"
          >
            {completed ? "Open the report" : "Review and begin"}
          </button>
        </div>
      )}
    </AppShell>
  );
}

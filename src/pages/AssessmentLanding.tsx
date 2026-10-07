import { useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import DeviceCheck from "../components/DeviceCheck";
import { PORTRAIT_SRC } from "../data/scenario";
import type { Report } from "../domain/report";
import type { Scenario } from "../domain/scenario";
import type { Product } from "../products";
import BuildStamp from "../components/BuildStamp";

// Conversation AI landing: an assessment brief built to fit a laptop viewport (about 1500 by 750).
// Six blocks on a dense sheet: the scene, your role, your goal, the challenge with its objectives,
// skills mapped (name and one liner) and instructions with a microphone and camera test. A sticky
// candidate card holds the confirmation and Begin. No gamification, no hints, no indicators shown.
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
  const player = scenario.stimulus.player;

  const META: [string, string][] = [
    ["Attempts", "1"],
    ["Time limit", `${minutes} min`],
    ["Skills", String(scenario.instrument.skills.length)],
    ["Pass mark", `${scenario.passScore}/10`],
  ];

  const INSTRUCTIONS = [
    `Find a quiet place and allow the full ${minutes} minutes in one sitting.`,
    "Test your microphone and camera. Both are optional; you can type every reply.",
    `Speak or type to ${persona.name.split(" ")[0]} as you would in a real call. Only your transcript is scored.`,
    "You have one attempt. The call ends when you end it or when the time runs out, and the report is saved.",
    "Tick the confirmation, then press Begin the assessment.",
  ];

  const Heading = ({ n, children }: { n: string; children: string }) => (
    <h2 className="flex items-baseline gap-3 mb-3">
      <span className="text-[11px] font-semibold tracking-[0.2em] text-brand tabular-nums">{n}</span>
      <span className="font-display font-semibold text-ink text-xl tracking-tight">{children}</span>
    </h2>
  );
  const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <section className={`border border-ink/15 p-5 ${className}`} style={{ background: "var(--surface)" }}>
      {children}
    </section>
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

      {/* Brief header: title left, meta right, one row */}
      <header className="max-w-7xl mx-auto px-6 md:px-10 pt-7 pb-5 animate-fade-in-up">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-ink/20 pb-5">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-brand mb-2 uppercase">
              Assessment brief · {scenario.category}
            </p>
            <h1 className="font-display font-semibold text-3xl md:text-4xl text-ink tracking-tight leading-[1.05] mb-2">
              {scenario.title}
            </h1>
            <p className="text-ink/75 text-sm leading-relaxed">
              {product.tagline} One conversation with {persona.name}, {persona.role} at {persona.organisation}
              .
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {META.map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink/70 text-[11px] uppercase tracking-widest mb-0.5">{k}</dt>
                <dd className="font-display font-semibold text-ink text-lg tabular-nums leading-tight">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 md:px-10 pb-10 grid lg:grid-cols-12 gap-5 items-start animate-fade-in-up">
        <div className="lg:col-span-8 space-y-5">
          <div className="grid md:grid-cols-3 gap-5">
            <Card>
              <Heading n="01">The scene</Heading>
              <p className="text-ink/80 text-sm leading-relaxed">{player.scene}</p>
            </Card>
            <Card>
              <Heading n="02">Your role</Heading>
              <p className="text-ink/80 text-sm leading-relaxed">{player.role}</p>
            </Card>
            <Card>
              <Heading n="03">Your goal</Heading>
              <p className="text-ink/80 text-sm leading-relaxed">{player.goal}</p>
            </Card>
          </div>

          <Card>
            <Heading n="04">The challenge</Heading>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
              <p className="text-ink/80 text-sm leading-relaxed">{player.challenge}</p>
              <div>
                <p className="text-ink/70 text-[11px] uppercase tracking-widest mb-2">
                  Objectives to achieve
                </p>
                <ol className="space-y-1.5">
                  {scenario.instrument.objectives.map((o, i) => (
                    <li key={o.id} className="grid grid-cols-[1.5rem_1fr] gap-x-2 text-sm leading-snug">
                      <span className="text-ink/60 text-xs tabular-nums pt-0.5">{i + 1}.</span>
                      <span>
                        <span className="font-display font-semibold text-ink">{o.label}</span>
                        <span className="text-ink/75">: {o.sub}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>

          <Card>
            <Heading n="06">Instructions</Heading>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
              <ol className="space-y-2">
                {INSTRUCTIONS.map((t, i) => (
                  <li key={t} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
                    <span className="text-ink/60 text-xs tabular-nums pt-0.5">{i + 1}.</span>
                    <span className="text-ink/80 text-sm leading-relaxed">{t}</span>
                  </li>
                ))}
              </ol>
              <div>
                <h3 className="font-display font-semibold text-ink text-base mb-1">
                  Audio and video access test
                </h3>
                <p className="text-ink/70 text-xs leading-relaxed mb-1">
                  Check that your browser can reach your microphone and camera before you begin.
                </p>
                <DeviceCheck />
              </div>
            </div>
          </Card>
        </div>

        {/* Candidate card */}
        <aside className="lg:col-span-4 space-y-5">
          <div
            className="border border-ink/15 grid grid-cols-[7rem_1fr]"
            style={{ background: "var(--surface)" }}
          >
            <figure
              className="relative overflow-hidden border-r border-ink/15"
              style={{ background: "var(--surface-2)" }}
            >
              <img
                src={PORTRAIT_SRC}
                alt={persona.portraitAlt}
                className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
              />
            </figure>
            <div className="p-4">
              <p className="text-ink/70 text-[11px] uppercase tracking-widest mb-1">Your counterpart</p>
              <p className="font-display font-semibold text-ink text-lg leading-tight">{persona.name}</p>
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
                <label className="flex items-start gap-3 text-sm text-ink/85 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                  />
                  <span>
                    I have read the brief and the instructions. I understand this is a single, timed attempt
                    and that the report will be saved.
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
          <Card>
            <Heading n="05">Skills mapped</Heading>
            <ul className="space-y-3">
              {scenario.instrument.skills.map((sk, i) => (
                <li key={sk.id} className="grid grid-cols-[1.75rem_1fr] gap-x-2">
                  <span className="text-brand text-[11px] font-semibold tabular-nums pt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="block font-display font-semibold text-ink text-[15px] leading-snug">
                      {sk.name}
                    </span>
                    <span className="block text-ink/75 text-xs leading-relaxed">{sk.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
      <BuildStamp product={product.name} />
    </div>
  );
}

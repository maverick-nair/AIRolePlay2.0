import { useEffect, useRef, useState, type ReactNode } from "react";
import ThemeToggle from "../components/ThemeToggle";
import DeviceCheck from "../components/DeviceCheck";
import { PORTRAIT_SRC } from "../data/scenario";
import type { Report } from "../domain/report";
import type { Scenario } from "../domain/scenario";
import type { Product } from "../products";
import BuildStamp from "../components/BuildStamp";
import useMediaQuery from "../lib/useMediaQuery";

// Thin line icons, one per brief block: straight segments and simple geometry, drawn on a 24 grid.
const ICONS: Record<string, ReactNode> = {
  scene: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3 15l5-4 4 3 3-2 6 4" />
    </>
  ),
  role: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  goal: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" />
    </>
  ),
  challenge: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2.5 4L17 12H6" />
    </>
  ),
  skills: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  instructions: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
    </>
  ),
};

// One numbered section of the brief. From md up it is a plain card; on phones it collapses so the
// page is short, with the scene and the instructions open by default.
function BriefSection({
  n,
  title,
  icon,
  defaultOpen,
  collapsible,
  children,
}: {
  n: string;
  title: string;
  icon: keyof typeof ICONS;
  defaultOpen: boolean;
  collapsible: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={collapsible ? defaultOpen : true}
      className="group border rounded-[var(--radius)] p-5 md:p-6"
      style={{ background: "var(--surface)", borderColor: "var(--edge)" }}
    >
      <summary
        className={`list-none flex items-baseline gap-3 [&::-webkit-details-marker]:hidden ${collapsible ? "cursor-pointer" : "cursor-default"} focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]`}
        tabIndex={collapsible ? 0 : -1}
        onClick={(e) => {
          if (!collapsible) e.preventDefault();
        }}
      >
        <h2 className="flex-1 flex items-center gap-3">
          <svg
            aria-hidden
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-none text-brand"
          >
            {ICONS[icon]}
          </svg>
          <span className="text-xs font-semibold tracking-[0.2em] text-ink/75 tabular-nums">{n}</span>
          <span className="font-display font-semibold text-ink text-xl tracking-tight leading-tight">
            {title}
          </span>
        </h2>
        {collapsible && (
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 14 14"
            className="self-center text-ink/70 transition-transform group-open:rotate-180"
          >
            <path
              d="M3 5l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

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
  const mdUp = useMediaQuery("(min-width: 768px)");
  const lgUp = useMediaQuery("(min-width: 1024px)");
  const collapsible = !mdUp;
  // On narrow screens the begin card sits below the brief, so a sticky bar carries the next step
  // until the card itself is on screen.
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

  return (
    <div className="relative isolate min-h-full overflow-auto" style={{ background: "transparent" }}>
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
          <span className="hidden sm:inline text-ink/70 text-xs uppercase tracking-widest border-l border-ink/15 pl-3">
            {product.line}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span
            className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 text-xs uppercase tracking-wider border"
            style={{ borderColor: "rgb(var(--accent-rgb) / 0.5)", color: "var(--brand)" }}
          >
            Assessment
          </span>
          <ThemeToggle />
        </div>
      </nav>

      {/* Brief header: title left, meta right, one row */}
      <main className={lgUp ? "" : "pb-24"}>
        <header className="max-w-7xl mx-auto px-6 md:px-10 pt-6 pb-5 animate-fade-in-up">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div className="max-w-4xl">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
                <span className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
                  Assessment brief · {scenario.category}
                </span>
                {scenario.instrument.claimRung === 1 && (
                  <span className="px-2 py-0.5 text-xs font-semibold border border-ink/30 text-ink/85">
                    Pilot assessment, feedback only
                  </span>
                )}
              </p>
              <h1 className="font-display font-semibold text-4xl md:text-[2.75rem] text-ink tracking-[-0.015em] leading-[1.05] mb-2">
                {scenario.title}
              </h1>
              <p className="text-ink/75 text-sm leading-relaxed">
                {product.tagline} One conversation with {persona.name}, {persona.role} at{" "}
                {persona.organisation}.
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {META.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-ink/70 text-xs uppercase tracking-widest mb-0.5">{k}</dt>
                  <dd className="font-display font-semibold text-ink text-lg tabular-nums leading-tight">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        {/* Three steps, in order. Each links to its part of the page; the last fills in once confirmed. */}
        {!completed && (
          <nav aria-label="Steps before you begin" className="max-w-7xl mx-auto px-6 md:px-10 pb-5">
            <ol className="grid grid-cols-3 gap-2 sm:gap-4">
              {[
                { href: "#brief", label: "Read the brief", short: "Brief", done: false },
                { href: "#devices", label: "Check your devices", short: "Devices", done: false },
                { href: "#begin", label: "Confirm and begin", short: "Begin", done: confirmed },
              ].map((st, i) => (
                <li key={st.href}>
                  <a
                    href={st.href}
                    className="flex items-center gap-2 sm:gap-3 rounded-[var(--radius)] border px-2.5 sm:px-3 py-2.5 h-full hover:border-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                    style={{
                      background: "var(--surface)",
                      borderColor: st.done ? "var(--brand)" : "var(--edge)",
                    }}
                  >
                    <span
                      className="w-7 h-7 flex-none rounded-full flex items-center justify-center text-sm font-semibold tabular-nums border"
                      style={
                        st.done
                          ? { background: "var(--accent)", borderColor: "var(--accent)", color: "#ffffff" }
                          : { borderColor: "rgb(var(--ink) / 0.4)", color: "rgb(var(--ink))" }
                      }
                    >
                      {st.done ? (
                        <svg aria-hidden width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M3 7.5l2.5 2.5L11 4.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        i + 1
                      )}
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

        <div className="max-w-7xl mx-auto px-6 md:px-10 pb-10 grid lg:grid-cols-12 gap-5 items-start animate-fade-in-up">
          <div id="brief" className="lg:col-span-8 space-y-5 scroll-mt-20">
            <div className="grid md:grid-cols-3 gap-5">
              <BriefSection n="01" title="The scene" icon="scene" defaultOpen collapsible={collapsible}>
                <p className="text-ink/80 text-sm leading-relaxed">{player.scene}</p>
              </BriefSection>
              <BriefSection
                n="02"
                title="Your role"
                icon="role"
                defaultOpen={false}
                collapsible={collapsible}
              >
                <p className="text-ink/80 text-sm leading-relaxed">{player.role}</p>
              </BriefSection>
              <BriefSection
                n="03"
                title="Your goal"
                icon="goal"
                defaultOpen={false}
                collapsible={collapsible}
              >
                <p className="text-ink/80 text-sm leading-relaxed">{player.goal}</p>
              </BriefSection>
            </div>

            <BriefSection
              n="04"
              title="The challenge"
              icon="challenge"
              defaultOpen={false}
              collapsible={collapsible}
            >
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
                <p className="text-ink/80 text-sm leading-relaxed">{player.challenge}</p>
                <div>
                  <p className="text-ink/70 text-xs uppercase tracking-widest mb-2">Objectives to achieve</p>
                  <ol className="space-y-1.5">
                    {scenario.instrument.objectives.map((o, i) => (
                      <li key={o.id} className="grid grid-cols-[1.5rem_1fr] gap-x-2 text-sm leading-snug">
                        <span className="text-ink/75 text-xs tabular-nums pt-0.5">{i + 1}.</span>
                        <span>
                          <span className="font-display font-semibold text-ink">{o.label}</span>
                          <span className="text-ink/75">: {o.sub}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </BriefSection>

            <BriefSection
              n="06"
              title="Instructions"
              icon="instructions"
              defaultOpen
              collapsible={collapsible}
            >
              <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
                <ol className="space-y-2">
                  {INSTRUCTIONS.map((t, i) => (
                    <li key={t} className="grid grid-cols-[1.5rem_1fr] gap-x-2">
                      <span className="text-ink/75 text-xs tabular-nums pt-0.5">{i + 1}.</span>
                      <span className="text-ink/80 text-sm leading-relaxed">{t}</span>
                    </li>
                  ))}
                </ol>
                <p className="md:col-start-1 text-ink/85 text-sm leading-relaxed pt-2 border-t border-ink/15 md:order-none">
                  Need more time? Extended time is available on request from your administrator.
                </p>
                <div id="devices" className="md:col-start-2 md:row-start-1 md:row-span-2 scroll-mt-20">
                  <h3 className="font-display font-semibold text-ink text-base mb-1">
                    Audio and video access test
                  </h3>
                  <p className="text-ink/70 text-xs leading-relaxed mb-1">
                    Check that your browser can reach your microphone and camera before you begin.
                  </p>
                  <DeviceCheck />
                </div>
              </div>
            </BriefSection>
          </div>

          {/* Candidate card: a 1:1 portrait beside a text panel of the same size */}
          <aside className="lg:col-span-4 space-y-5">
            <div
              className="border rounded-[var(--radius)] overflow-hidden grid grid-cols-2"
              style={{ background: "var(--surface)", borderColor: "var(--edge)" }}
            >
              <figure
                className="relative aspect-square overflow-hidden border-r"
                style={{ background: "var(--surface-2)", borderColor: "var(--edge)" }}
              >
                <img
                  src={PORTRAIT_SRC}
                  alt={persona.portraitAlt}
                  className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
                />
              </figure>
              <div className="aspect-square p-4 flex flex-col justify-center">
                <p className="text-ink/70 text-xs uppercase tracking-widest mb-1">Your counterpart</p>
                <p className="font-display font-semibold text-ink text-xl leading-tight">{persona.name}</p>
                <p className="text-ink/75 text-sm mt-1">
                  {persona.role}, {persona.organisation}
                </p>
              </div>
            </div>

            <section
              id="begin"
              ref={beginRef}
              className="border-2 rounded-[var(--radius)] p-5 md:p-6 scroll-mt-20"
              style={{ background: "var(--surface)", borderColor: "var(--brand)" }}
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
                    <span className="font-display font-semibold text-ink">{completed.scores.overall}/10</span>
                    . The one attempt has been used; the report is saved under {completed.id}.
                  </p>
                  <button
                    onClick={() => onViewReport(completed)}
                    className="w-full btn btn-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                  >
                    Open the report
                  </button>
                </>
              ) : (
                <>
                  <h2 className="font-display font-semibold text-ink text-xl mb-3">Before you begin</h2>
                  <label className="flex items-start gap-3 text-sm text-ink/85 cursor-pointer mb-4">
                    <input
                      id="confirm-begin"
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
                    className="w-full btn btn-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
                  >
                    Begin the assessment
                  </button>
                  <p className="text-ink/70 text-xs mt-3 leading-relaxed">
                    {minutes} minutes, one sitting. Find a quiet place and allow the full time.
                  </p>
                </>
              )}
            </section>
            <BriefSection
              n="05"
              title="Skills mapped"
              icon="skills"
              defaultOpen={false}
              collapsible={collapsible}
            >
              <ul className="space-y-3">
                {scenario.instrument.skills.map((sk, i) => (
                  <li key={sk.id} className="grid grid-cols-[1.75rem_1fr] gap-x-2">
                    <span className="text-brand text-xs font-semibold tabular-nums pt-1">
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
            </BriefSection>
          </aside>
        </div>
      </main>
      <BuildStamp product={product.name} />

      {!lgUp && !beginVisible && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/15 px-4 pt-3 flex items-center gap-3"
          style={{
            background: "color-mix(in srgb, var(--bg) 94%, transparent)",
            backdropFilter: "blur(8px)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <p className="flex-1 min-w-0 text-ink/80 text-xs leading-snug">
            {completed ? "Your one attempt is complete." : `${minutes} minutes, one attempt.`}
          </p>
          <button
            onClick={() => (completed ? onViewReport(completed) : goToBegin())}
            className="btn btn-primary px-5 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)]"
          >
            {completed ? "Open the report" : "Review and begin"}
          </button>
        </div>
      )}
    </div>
  );
}

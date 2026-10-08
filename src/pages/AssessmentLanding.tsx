import { useState, type ReactNode } from "react";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import DeviceCheck from "../components/DeviceCheck";
import { PORTRAIT_SRC } from "../data/scenario";
import type { Report } from "../domain/report";
import type { Scenario } from "../domain/scenario";
import type { Product } from "../products";

const mono = { fontFamily: "var(--font-mono)" };

// One numbered section of the brief: a mono index, a heading and its text, like a printed paper.
function BriefRow({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[2rem_1fr] gap-x-2 break-inside-avoid">
      <span className="t-small text-brand pt-px tabular-nums" style={mono}>
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="font-semibold text-ink text-[15px] leading-tight mb-0.5">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function PanelTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-[15px] font-semibold text-ink leading-tight mb-2">
      {children}
    </h2>
  );
}

// Conversation AI home: the assessment brief on one screen, in a quiet, formal register. Left is the
// brief as a numbered paper, the middle is what is assessed and how the call runs, the right is the
// counterpart, the device check and the begin card. Nothing is behind a tab, step link or drawer.
// No game layer, no hints, and the behaviour indicators stay hidden until the report.
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
  const pilot = scenario.instrument.claimRung === 1;

  const INSTRUCTIONS = [
    `Find a quiet place and allow the full ${minutes} minutes in one sitting.`,
    "Test your microphone and camera. Both are optional; you can type every reply.",
    `Speak or type to ${persona.name.split(" ")[0]} as you would in a real call. Only your transcript is scored.`,
    "You have one attempt. The call ends when you end it or when the time runs out, and the report is saved.",
    "Tick the confirmation, then press Begin the assessment.",
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
      <div className="md:h-full flex flex-col gap-2.5 p-2.5 lg:gap-3 lg:p-3">
        {/* Header strip: what this is and its terms */}
        <header className="card flex-none flex flex-wrap items-center gap-x-6 gap-y-1.5 px-4 py-2.5">
          <div className="min-w-0 mr-auto">
            <p className="t-small text-ink/80">
              Assessments <span aria-hidden>/</span> {scenario.category}
            </p>
            <h1 className="text-lg xl:text-xl font-semibold tracking-tight text-ink leading-tight">
              {scenario.title}
            </h1>
          </div>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 t-small text-ink/85" aria-label="Terms">
            <li className="flex items-center gap-1.5">
              <Icon name="clock" size={15} /> {minutes} min time limit
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="attempts" size={15} /> One attempt
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="target" size={15} /> Pass mark {scenario.passScore}/10
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="layers" size={15} /> {scenario.instrument.skills.length} skills
            </li>
            {pilot && (
              <li>
                <span className="chip chip-neutral">Pilot assessment, feedback only</span>
              </li>
            )}
          </ul>
        </header>

        <div className="flex-1 min-h-0 flex flex-col gap-2.5 md:gap-2 md:grid md:grid-cols-2 md:content-start lg:content-stretch lg:gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1fr)]">
          {/* The brief, as a numbered paper */}
          <article
            className="card flex-none p-3 lg:p-4 md:col-span-2 md:columns-2 md:gap-x-6 lg:col-span-1 lg:columns-1 lg:flex lg:flex-col"
            aria-labelledby="brief-heading"
          >
            <PanelTitle id="brief-heading">Assessment brief</PanelTitle>
            <div className="flex flex-col gap-2 xl:gap-2.5 md:block md:[&>*+*]:mt-2.5 lg:flex lg:[&>*+*]:mt-0">
              <BriefRow n="01" title="The scene">
                <p className="t-body text-ink/90">{player.scene}</p>
              </BriefRow>
              <BriefRow n="02" title="Your role">
                <p className="t-body text-ink/90">{player.role}</p>
              </BriefRow>
              <BriefRow n="03" title="Your goal">
                <p className="t-body text-ink/90">{player.goal}</p>
              </BriefRow>
              <BriefRow n="04" title="The challenge">
                <p className="t-body text-ink/90">{player.challenge}</p>
                <p className="mt-1.5 t-small font-semibold text-ink">Objectives to achieve</p>
                <ol className="mt-0.5 flex flex-col gap-0.5">
                  {scenario.instrument.objectives.map((o, i) => (
                    <li key={o.id} className="grid grid-cols-[1.25rem_1fr] t-small">
                      <span className="text-ink/80 tabular-nums">{i + 1}.</span>
                      <span>
                        <span className="font-semibold text-ink">{o.label}</span>
                        <span className="text-ink/85">: {o.sub}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </BriefRow>
            </div>
          </article>

          {/* Who you meet, and what is assessed */}
          <div className="flex-none flex flex-col gap-2.5 md:contents lg:flex lg:gap-3">
            <section
              className="card p-3 lg:p-4 flex items-center gap-3 md:col-start-1 md:row-start-3 lg:row-auto lg:col-auto"
              aria-label="Your counterpart"
            >
              <figure
                className="relative w-14 aspect-square flex-none overflow-hidden rounded-[var(--radius-sm)]"
                style={{ background: "var(--surface-2)" }}
              >
                <img
                  src={PORTRAIT_SRC}
                  alt={persona.portraitAlt}
                  className="portrait-img absolute inset-0 w-full h-full object-cover object-top"
                />
              </figure>
              <div className="min-w-0">
                <p className="t-small text-ink/80">Your counterpart</p>
                <p className="font-semibold text-ink text-[15px] leading-tight">{persona.name}</p>
                <p className="t-small text-ink/85">
                  {persona.role}, {persona.organisation}
                </p>
              </div>
            </section>
            <section
              className="card flex-none p-3 lg:p-4 md:col-span-2 md:row-start-2 md:columns-2 md:gap-x-6 lg:col-auto lg:row-auto lg:columns-1"
              aria-labelledby="skills-mapped-heading"
            >
              <div>
                <PanelTitle id="skills-mapped-heading">Skills mapped</PanelTitle>
                <ul className="flex flex-col gap-2">
                  {scenario.instrument.skills.map((sk, i) => (
                    <li key={sk.id} className="grid grid-cols-[2rem_1fr] break-inside-avoid">
                      <span className="t-small text-brand tabular-nums pt-px" style={mono}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink t-body leading-tight">{sk.name}</span>
                        <span className="block text-ink/80 t-small">{sk.desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          {/* Devices and begin */}
          <div className="flex-none flex flex-col gap-2.5 md:contents lg:flex lg:gap-3">
            <section
              className="card p-3 lg:p-4 md:col-start-1 md:row-start-4 lg:row-auto lg:col-auto"
              aria-labelledby="devices-heading"
            >
              <h2 id="devices-heading" className="text-[15px] font-semibold text-ink leading-tight mb-1">
                Audio and video access test
              </h2>
              <DeviceCheck />
            </section>

            <section
              className="card p-3 lg:p-4 md:col-start-2 md:row-start-3 md:row-span-2 lg:row-auto lg:col-auto lg:row-span-1"
              style={{ borderColor: "var(--accent-ui)", borderWidth: 2 }}
              aria-labelledby="begin-heading"
            >
              {completed ? (
                <>
                  <PanelTitle id="begin-heading">Assessment complete</PanelTitle>
                  <p className="t-body text-ink/85 mb-3">
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
                  <PanelTitle id="begin-heading">Before you begin</PanelTitle>
                  <ol className="flex flex-col gap-1" aria-label="Instructions">
                    {INSTRUCTIONS.map((t, i) => (
                      <li key={t} className="grid grid-cols-[1.25rem_1fr] t-small">
                        <span className="text-ink/80 tabular-nums">{i + 1}.</span>
                        <span className="text-ink/90">{t}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-1.5 mb-3 t-small text-ink/90 font-medium">
                    Need more time? Extended time is available on request from your administrator.
                  </p>
                  <label className="flex items-start gap-2.5 t-body text-ink/90 cursor-pointer mb-3">
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
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

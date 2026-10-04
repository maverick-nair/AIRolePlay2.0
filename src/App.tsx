import { useEffect, useState } from "react";
import type { Page } from "./types";
import { ThemeContext } from "./lib/theme";
import LandingPage, { type StartOptions } from "./pages/LandingPage";
import SessionPage from "./pages/SessionPage";
import SummaryPage from "./pages/SummaryPage";
import { renewalNegotiation } from "./data/scenarios/renewalNegotiation";
import type { Report } from "./domain/report";
import type { Mode } from "./domain/scenario";
import { assessmentAttempt, listAttempts } from "./store/attempts";

type SessionConfig = { mode: Mode; options: StartOptions; key: number };

export default function App() {
  const scenario = renewalNegotiation;
  const [page, setPage] = useState<Page>("landing");
  const [dark, setDark] = useState(true);
  const [config, setConfig] = useState<SessionConfig>({
    mode: "practice",
    options: { difficulty: "firm", hints: true },
    key: 0,
  });
  const [report, setReport] = useState<Report | null>(null);
  const [attempts, setAttempts] = useState<Report[]>(() => listAttempts(scenario.id));
  const assessment = attempts.find((a) => a.mode === "assessment") ?? assessmentAttempt(scenario.id);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  function start(mode: Mode, options: StartOptions) {
    // One attempt only: a completed assessment opens its report instead of a new session.
    if (mode === "assessment" && assessment) {
      setReport(assessment);
      setPage("summary");
      return;
    }
    setConfig((c) => ({ mode, options, key: c.key + 1 }));
    setPage("session");
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <div className="h-full" style={{ background: "transparent" }}>
        {page === "landing" && (
          <LandingPage
            scenario={scenario}
            attempts={attempts}
            assessment={assessment}
            onStart={start}
            onViewReport={(r) => {
              setReport(r);
              setPage("summary");
            }}
          />
        )}
        {page === "session" && (
          <SessionPage
            key={config.key}
            scenario={scenario}
            mode={config.mode}
            difficulty={config.options.difficulty}
            hints={config.options.hints}
            onEnd={(r) => {
              setReport(r);
              setAttempts(listAttempts(scenario.id));
              setPage("summary");
            }}
          />
        )}
        {page === "summary" && report && (
          <SummaryPage
            report={report}
            scenario={scenario}
            attempts={attempts.filter((a) => a.mode === report.mode)}
            onPractiseAgain={() => start("practice", config.options)}
            onHome={() => setPage("landing")}
          />
        )}
      </div>
    </ThemeContext.Provider>
  );
}

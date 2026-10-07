import { useEffect, useState } from "react";
import { ThemeContext } from "../lib/theme";
import PracticeLanding, { type PracticeOptions } from "../pages/PracticeLanding";
import SessionPage from "../pages/SessionPage";
import SummaryPage from "../pages/SummaryPage";
import { renewalNegotiation } from "../data/scenarios/renewalNegotiation";
import type { Report } from "../domain/report";
import { PRODUCTS, applyProductTheme } from "../products";
import { listAttempts } from "../store/attempts";
import { practiceRunsLeft } from "../domain/scoring";

// AI RolePlay: the practice product. Up to maxPracticeAttempts runs per scenario, rewind, hints,
// adaptive persona.
const product = PRODUCTS.roleplay;
type Page = "landing" | "session" | "summary";

export default function PracticeApp() {
  const scenario = renewalNegotiation;
  const [page, setPage] = useState<Page>("landing");
  const [dark, setDark] = useState(true);
  const [options, setOptions] = useState<PracticeOptions>({ difficulty: "firm", hints: true });
  const [runKey, setRunKey] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [attempts, setAttempts] = useState<Report[]>(() => listAttempts(scenario.id, "practice"));
  const runsLeft = practiceRunsLeft(attempts.length, scenario.maxPracticeAttempts);

  useEffect(() => applyProductTheme(product), []);
  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  function start(next: PracticeOptions) {
    if (runsLeft <= 0) return;
    setOptions(next);
    setRunKey((k) => k + 1);
    setPage("session");
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <div className="h-full" style={{ background: "transparent" }}>
        {page === "landing" && (
          <PracticeLanding
            product={product}
            scenario={scenario}
            attempts={attempts}
            runsLeft={runsLeft}
            onStart={start}
            onViewReport={(r) => {
              setReport(r);
              setPage("summary");
            }}
          />
        )}
        {page === "session" && (
          <SessionPage
            key={runKey}
            product={product}
            scenario={scenario}
            mode="practice"
            difficulty={options.difficulty}
            hints={options.hints}
            onEnd={(r) => {
              setReport(r);
              setAttempts(listAttempts(scenario.id, "practice"));
              setPage("summary");
            }}
          />
        )}
        {page === "summary" && report && (
          <SummaryPage
            product={product}
            report={report}
            scenario={scenario}
            attempts={attempts}
            runsLeft={runsLeft}
            onPractiseAgain={() => start(options)}
            onHome={() => setPage("landing")}
          />
        )}
      </div>
    </ThemeContext.Provider>
  );
}

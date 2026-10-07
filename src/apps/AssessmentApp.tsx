import { useEffect, useState } from "react";
import { ThemeContext } from "../lib/theme";
import AssessmentLanding from "../pages/AssessmentLanding";
import SessionPage from "../pages/SessionPage";
import SummaryPage from "../pages/SummaryPage";
import { renewalNegotiation } from "../data/scenarios/renewalNegotiation";
import type { Report } from "../domain/report";
import { PRODUCTS, applyProductTheme } from "../products";
import { assessmentAttempt } from "../store/attempts";

// Conversation AI: the assessment product. One attempt, standardised persona, hidden criteria.
const product = PRODUCTS["conversation-ai"];
type Page = "landing" | "session" | "summary";

export default function AssessmentApp() {
  const scenario = renewalNegotiation;
  const [page, setPage] = useState<Page>("landing");
  const [dark, setDark] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [completed, setCompleted] = useState<Report | null>(() => assessmentAttempt(scenario.id));

  useEffect(() => applyProductTheme(product), []);
  useEffect(() => {
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      <div className="h-full" style={{ background: "transparent" }}>
        {page === "landing" && (
          <AssessmentLanding
            product={product}
            scenario={scenario}
            completed={completed}
            onBegin={() => {
              // One attempt only: a completed assessment opens its report instead of a new session.
              if (completed) {
                setReport(completed);
                setPage("summary");
                return;
              }
              setPage("session");
            }}
            onViewReport={(r) => {
              setReport(r);
              setPage("summary");
            }}
          />
        )}
        {page === "session" && (
          <SessionPage
            product={product}
            scenario={scenario}
            mode="assessment"
            difficulty="firm"
            hints={false}
            onEnd={(r) => {
              setReport(r);
              setCompleted(r);
              setPage("summary");
            }}
          />
        )}
        {page === "summary" && report && (
          <SummaryPage
            product={product}
            report={report}
            scenario={scenario}
            attempts={[report]}
            onPractiseAgain={() => setPage("landing")}
            onHome={() => setPage("landing")}
          />
        )}
      </div>
    </ThemeContext.Provider>
  );
}

import type { Report } from "../domain/report";
import { formatDuration, tagTranscript } from "../domain/report";
import type { Scenario } from "../domain/scenario";
import { CLAIM_LADDER } from "../domain/instrumentStatus";
import { formatTalkShare } from "../domain/descriptive";
import { bandFor } from "./score";

// The PDF is a rendering of the report object: engine output, authored copy and the narrative.
export default async function buildReportPdf(report: Report, scenario: Scenario) {
  // Loaded on demand so the PDF library stays out of the initial bundle.
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (
    t: string,
    size = 10,
    style: "normal" | "bold" | "italic" = "normal",
    color: [number, number, number] = [30, 26, 22],
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(t, W - M * 2);
    ensure(wrapped.length * size * 1.35);
    doc.text(wrapped, M, y);
    y += wrapped.length * size * 1.35;
  };
  const gap = (h = 10) => (y += h);
  const heading = (t: string) => {
    gap(8);
    ensure(30);
    doc.setDrawColor(194, 65, 12);
    doc.setLineWidth(1.5);
    doc.line(M, y, M + 28, y);
    gap(14);
    text(t, 13, "bold");
    gap(4);
  };
  const band = bandFor(report.scores.overall);
  const rung = CLAIM_LADDER[scenario.instrument.claimRung];
  const date = new Date(report.completedAt).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  text(
    `AI ROLEPLAY  ·  ${report.mode === "assessment" ? "ASSESSMENT REPORT" : "PRACTICE REPORT"}`,
    9,
    "bold",
    [184, 50, 15],
  );
  gap(6);
  text(scenario.title, 20, "bold");
  text(
    `${report.id}   ·   ${date}   ·   Duration ${formatDuration(report.durationSeconds)}`,
    9,
    "normal",
    [90, 84, 78],
  );
  text(
    `Instrument ${scenario.instrument.id} v${scenario.instrument.version}. Claim rung ${scenario.instrument.claimRung} of 4 (${rung.title}): ${rung.fitFor}`,
    9,
    "italic",
    [90, 84, 78],
  );

  heading("Performance Overview");
  text(
    `Overall score: ${report.scores.overall}/10  (${band.label}, weighted average ${report.scores.weightedAverage.toFixed(2)}). ${report.scores.passed ? "Met" : "Did not meet"} the pass mark of ${scenario.passScore}.`,
    12,
    "bold",
  );
  text(
    "Knolskape ten-point scale: Novice 1-2, Emerging 3-4, Competent 5-6, Proficient 7-8, Role Model 9-10.",
    9,
    "normal",
    [90, 84, 78],
  );
  text(
    `Indicators observed: ${Math.round(report.scores.coverage * 100)}%. Talk to listen ${formatTalkShare(report.metrics.talkShare)}. Questions ${report.metrics.questions} (${report.metrics.openQuestions} open). Offers ${report.metrics.conditionalOffers} conditional, ${report.metrics.unconditionalOffers} unconditional.`,
    9,
  );
  gap(6);
  report.narrative.overall.forEach((p) => text(p, 10));
  gap(4);
  text("Recommendations", 10, "bold");
  report.narrative.recommendations.forEach((r) => text(`•  ${r.title}: ${r.detail}`, 10));

  heading("Evidence by Skill");
  report.scores.skills.forEach((s, i) => {
    ensure(60);
    text(
      `${i + 1}. ${s.name}  ·  ${s.score}/10 ${bandFor(s.score).label}  ·  weight ${s.weight}%`,
      11,
      "bold",
    );
    const fb = report.narrative.skillFeedback[s.id];
    if (fb) text(fb, 9.5);
    s.indicators.forEach((ind) => {
      text(`    ${ind.label}: ${ind.band ?? "Not observed"}`, 9, "bold", [60, 56, 52]);
      ind.evidence.forEach((e) =>
        text(`        "${e.quote}" (${report.transcript[e.turnIndex]?.time ?? ""}) ${e.note}`, 9),
      );
    });
    gap(8);
  });

  if (report.narrative.language) {
    const L = report.narrative.language;
    heading("Communication (descriptive)");
    text(`CEFR level: ${L.cefr.overall} (${L.cefr.band}). ${L.cefr.summary}`, 10);
    L.cefr.dimensions.forEach((d) => text(`    ${d.name}: ${d.level}. ${d.note}`, 9));
    text(`Sentiment: ${L.sentiment.map((x) => `${x.label} ${x.pct}%`).join(", ")}`, 10);
    text(`Tone: ${L.tone.map((x) => `${x.label} ${x.pct}%`).join(", ")}`, 10);
    text(`Clarity: ${L.clarity.score.toFixed(1)}/10. ${L.clarity.note}`, 10);
  }

  heading("Transcript");
  tagTranscript(report).forEach((l) => {
    text(
      `${l.time}  ${l.speaker}${l.tag ? `  [${l.tag === "strength" ? "Strength" : "Missed opportunity"}]` : ""}`,
      9,
      "bold",
      [90, 84, 78],
    );
    text(l.text, 10);
    gap(4);
  });

  heading("Method");
  text(
    `Bands (Strong, Adequate, Weak, Harmful) were assigned per behavioural indicator from the participant's own words. Points come from a fixed table (10, 7, 4, 1); unobserved indicators count 4. Skill scores are the rounded mean of indicator points; the overall score is the weighted mean. Narrative by ${report.narrative.meta.provider}${report.narrative.meta.model ? ` (${report.narrative.meta.model}, prompt ${report.narrative.meta.promptVersion})` : ""}. Two pass agreement: ${report.agreement === null ? "not measured" : `${Math.round(report.agreement * 100)}%`}.`,
    9,
  );

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 114, 108);
    doc.text(`${report.id}  ·  Page ${i} of ${pages}`, M, H - 24);
  }
  return doc;
}

export const pdfName = (report: Report) => `${report.id}-roleplay-report.pdf`;

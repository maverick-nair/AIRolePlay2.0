import { useEffect, useRef, useState } from "react";
import type { Report } from "../domain/report";
import type { Scenario } from "../domain/scenario";
import { scoreLabel } from "../lib/score";

// Email is a mailto handoff until the backend sends with the PDF attached. The summary in the
// body is drawn from the report object, never typed in by hand.
export default function EmailDialog({
  report,
  scenario,
  pdfName,
  onClose,
  onDownload,
}: {
  report: Report;
  scenario: Scenario;
  pdfName: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+(\s*,\s*[^\s@]+@[^\s@]+\.[^\s@]+)*$/.test(to.trim());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  function send() {
    if (!valid) return;
    const body = [
      note.trim(),
      note.trim() ? "" : null,
      scenario.title,
      `${report.mode === "assessment" ? "Assessment" : "Practice"} report ${report.id}`,
      `Overall score: ${report.scores.overall}/10 (${scoreLabel(report.scores.overall)})`,
      "",
      ...report.scores.skills.map((k) => `${k.name}: ${k.score}/10`),
      "",
      "Recommendations:",
      ...report.narrative.recommendations.map((x) => `- ${x.title}`),
      "",
      `The full PDF report (${pdfName}) is attached.`,
    ]
      .filter((x) => x !== null)
      .join("\n");
    onDownload();
    window.location.href = `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(`Roleplay Report: ${scenario.title}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgb(0 0 0 / 0.55)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-title"
        className="w-full max-w-md rounded-2xl border border-ink/15 p-6 animate-fade-in-up"
        style={{ background: "var(--bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <>
            <h2 id="email-title" className="font-display font-semibold text-ink text-lg mb-2">
              Report ready to send
            </h2>
            <p className="text-ink/80 text-sm leading-relaxed mb-5">
              Your email app has opened with a summary addressed to <strong className="text-ink">{to}</strong>
              . The PDF has also been downloaded as <strong className="text-ink">{pdfName}</strong>. Attach it
              before you send.
            </p>
            <button
              onClick={onClose}
              className="w-full px-5 py-3 rounded-xl font-display font-semibold text-sm text-white min-h-[44px]"
              style={{ background: "var(--accent)" }}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <h2 id="email-title" className="font-display font-semibold text-ink text-lg mb-1">
              Email this report
            </h2>
            <p className="text-ink/75 text-sm mb-5">Share your results with a manager, coach, or yourself.</p>
            <label htmlFor="email-to" className="block text-ink text-xs font-semibold mb-1.5">
              Recipients
            </label>
            <input
              id="email-to"
              ref={inputRef}
              type="text"
              inputMode="email"
              autoComplete="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@company.com"
              aria-describedby="email-hint"
              className="w-full px-3.5 py-2.5 rounded-xl border border-ink/20 bg-transparent text-ink text-sm placeholder:text-ink/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            />
            <p id="email-hint" className="text-ink/70 text-xs mt-1.5 mb-4">
              Separate multiple addresses with commas.
            </p>
            <label htmlFor="email-note" className="block text-ink text-xs font-semibold mb-1.5">
              Message (optional)
            </label>
            <textarea
              id="email-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-ink/20 bg-transparent text-ink text-sm resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] mb-5"
            />
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-5 py-3 rounded-xl border border-ink/20 font-display font-semibold text-sm text-ink min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={!valid}
                className="flex-1 px-5 py-3 rounded-xl font-display font-semibold text-sm text-white min-h-[44px] disabled:cursor-not-allowed"
                style={{ background: valid ? "var(--accent)" : "rgb(var(--ink) / 0.35)" }}
              >
                Send report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

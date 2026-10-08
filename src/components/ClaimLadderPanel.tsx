import { claimLadder } from "../domain/instrumentStatus";
import type { ClaimRung } from "../domain/scenario";

// The four rungs of the claim ladder, with the instrument's current position. Shown wherever a
// score is shown, so no reader mistakes structured feedback for a validated assessment.
export default function ClaimLadderPanel({ current }: { current: ClaimRung }) {
  return (
    <ol className="grid md:grid-cols-4 gap-3" aria-label="Claim ladder">
      {claimLadder(current).map((r) => {
        const isCurrent = r.state === "current";
        return (
          <li
            key={r.rung}
            className="rounded-xl p-4 border flex flex-col gap-2"
            style={{
              background: isCurrent ? "rgb(var(--accent-rgb) / 0.12)" : "var(--surface-2)",
              borderColor: isCurrent ? "rgb(var(--accent-rgb) / 0.6)" : "rgb(var(--ink) / 0.1)",
              opacity: r.state === "ahead" ? 0.75 : 1,
            }}
            aria-current={isCurrent ? "step" : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold tracking-widest uppercase text-ink/75">
                Rung {r.rung}
              </span>
              <span
                className="text-[11px] font-display font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={
                  isCurrent
                    ? { background: "var(--accent)", color: "#fff" }
                    : r.state === "earned"
                      ? { background: "rgba(52,211,153,0.16)", color: "var(--ok)" }
                      : { background: "rgb(var(--ink) / 0.08)", color: "rgb(var(--ink) / 0.75)" }
                }
              >
                {r.state === "current" ? "Current" : r.state === "earned" ? "Earned" : "Not yet"}
              </span>
            </div>
            <p className="font-display font-semibold text-ink text-sm">{r.title}</p>
            <p className="text-ink/80 text-xs leading-relaxed">{r.claim}</p>
            <p className="text-ink/70 text-[11px] leading-relaxed">
              <span className="font-semibold text-ink/80">Requires:</span> {r.requires}
            </p>
            <p className="text-ink/70 text-[11px] leading-relaxed mt-auto">
              <span className="font-semibold text-ink/80">Fit for:</span> {r.fitFor}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

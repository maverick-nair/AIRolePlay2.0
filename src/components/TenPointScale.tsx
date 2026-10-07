import { KNOLSKAPE_BANDS } from "../data/bands";
import { bandFor } from "../lib/score";
import { readableOn } from "../lib/color";

export default function TenPointScale({
  score,
  raw,
  description,
}: {
  score: number;
  raw?: number;
  description: string;
}) {
  const active = bandFor(score);

  return (
    <div className="card flex flex-col p-4 sm:p-6 md:p-7">
      <p className="text-ink/80 text-[13px] font-semibold mb-5">Overall negotiation score</p>

      <div className="flex flex-col sm:flex-row sm:items-start gap-6 mb-10">
        <div className="flex items-baseline gap-2">
          <span className="text-8xl font-display font-bold leading-none text-ink tabular-nums">{score}</span>
          <span className="text-3xl text-ink/75 font-display">/10</span>
        </div>
        <div className="flex flex-col gap-3 max-w-md sm:mt-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: active.color, color: readableOn(active.color) }}
            >
              {active.label}
            </span>
            {raw !== undefined && (
              <span className="text-ink/75 text-xs tabular-nums">Weighted average {raw.toFixed(2)}</span>
            )}
          </div>
          <p className="text-ink/80 text-sm leading-relaxed">{description}</p>
        </div>
      </div>

      <p className="text-ink/80 text-[13px] font-semibold mb-4">KNOLSKAPE ten point scale</p>
      <div
        className="grid grid-cols-5 gap-1 sm:gap-2 md:gap-3"
        role="img"
        aria-label={`Score ${score} of 10, ${active.label} band (${active.min} to ${active.max})`}
      >
        {KNOLSKAPE_BANDS.map((b) => {
          const on = b === active;
          return (
            <div key={b.label} className="flex flex-col">
              <div
                className="grid grid-cols-2 gap-0.5 p-1 rounded-lg transition-all duration-500"
                style={
                  on
                    ? {
                        background: "var(--surface)",
                        transform: "translateY(-4px)",
                        boxShadow: `0 14px 28px -10px ${b.color}, 0 4px 10px -4px rgb(0 0 0 / 0.35), inset 0 0 0 1.5px ${b.color}`,
                      }
                    : { background: "transparent" }
                }
              >
                {[b.min, b.max].map((n) => {
                  const here = on && n === score;
                  return (
                    <div
                      key={n}
                      className="h-9 flex items-center justify-center text-xs font-bold tabular-nums rounded-md"
                      style={{
                        background: on ? b.color : `color-mix(in srgb, ${b.color} 30%, var(--surface))`,
                        color: on ? readableOn(b.color) : "rgb(var(--ink) / 0.85)",
                        outline: here ? `2px solid rgb(var(--ink))` : "none",
                        outlineOffset: 2,
                      }}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
              <span
                className={`mt-3 text-center text-xs leading-tight min-w-0 ${on ? "font-bold text-ink" : "font-medium text-ink/75"}`}
              >
                {b.label}
              </span>
              <span className="text-center text-xs text-ink/75 tabular-nums">
                {b.min}-{b.max}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

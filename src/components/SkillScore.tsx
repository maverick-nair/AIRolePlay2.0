import { bandFor } from "../lib/score";
import { readableOn } from "../lib/color";

// Ten-segment meter for a single skill: numeral, band, and exact position on the scale.
export default function SkillScore({ score }: { score: number }) {
  const b = bandFor(score);
  return (
    <div
      className="flex flex-col items-end gap-1.5 w-[8.5rem]"
      role="img"
      aria-label={`${score} out of 10, ${b.label}`}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="font-display font-bold text-ink text-2xl leading-none tabular-nums">{score}</span>
        <span className="text-ink/70 text-xs font-display">/10</span>
        <span
          className="ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold font-display"
          style={{ background: b.color, color: readableOn(b.color) }}
        >
          {b.label}
        </span>
      </div>
      <div className="flex gap-[3px] w-full" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const inBand = n >= b.min && n <= b.max;
          return (
            <span
              key={n}
              className="flex-1 h-2 rounded-[2px]"
              style={{
                background: n <= score ? b.color : "rgb(var(--ink) / 0.12)",
                boxShadow: inBand ? `0 0 0 1px ${b.color}` : undefined,
                marginLeft: n > 1 && n % 2 === 1 ? 3 : 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

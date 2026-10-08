import { bandFor } from "../lib/score";

// Scores across practice attempts on the same instrument. Shows direction of travel, not a grade.
export default function AttemptTrend({ scores, currentIndex }: { scores: number[]; currentIndex: number }) {
  const w = 260;
  const h = 72;
  const padX = 14;
  const padY = 10;
  const n = scores.length;
  const x = (i: number) => (n === 1 ? w / 2 : padX + (i * (w - padX * 2)) / (n - 1));
  const y = (s: number) => h - padY - ((s - 1) / 9) * (h - padY * 2);
  const path = scores.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-auto"
      role="img"
      aria-label={`Scores across ${n} attempts: ${scores.join(", ")} out of 10`}
    >
      {[1, 5, 10].map((g) => (
        <line
          key={g}
          x1={padX}
          x2={w - padX}
          y1={y(g)}
          y2={y(g)}
          stroke="rgb(var(--ink) / 0.1)"
          strokeDasharray="2 3"
        />
      ))}
      {n > 1 && <path d={path} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinejoin="round" />}
      {scores.map((s, i) => (
        <g key={i}>
          <circle
            cx={x(i)}
            cy={y(s)}
            r={i === currentIndex ? 5 : 3.5}
            fill={bandFor(s).color}
            stroke={i === currentIndex ? "rgb(var(--ink))" : "var(--surface)"}
            strokeWidth={1.5}
          />
          <text x={x(i)} y={h - 1} textAnchor="middle" fontSize={8} fill="rgb(var(--ink) / 0.7)">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

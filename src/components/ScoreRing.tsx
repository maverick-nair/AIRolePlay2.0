import { bandFor } from "../lib/score";

export default function ScoreRing({
  score,
  max = 10,
  size = 120,
}: {
  score: number;
  max?: number;
  size?: number;
  level: string;
}) {
  const radius = (size - 20) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = score / max;
  const dash = pct * circ;

  const color = bandFor(score).color;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--ink) / 0.07)"
          strokeWidth={8}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 1s ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-ink" style={{ fontSize: size * 0.26, lineHeight: 1 }}>
          {score}
        </span>
        <span
          style={{
            fontSize: size * 0.1,
            color: "rgb(var(--ink) / 0.65)",
            fontFamily: "Inter",
          }}
        >
          /{max}
        </span>
      </div>
    </div>
  );
}

import { bandFor } from "../lib/score";

export type RadarSkill = { name: string; score: number; peer: number };

// Hexagonal radar of the assessed skills on the 10-point scale, with an optional
// dashed peer-average outline.
export default function SkillRadar({ skills, compare }: { skills: RadarSkill[]; compare: boolean }) {
  const size = 240;
  const c = size / 2;
  const R = 84;
  const n = skills.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * R * (v / 10), c + Math.sin(a) * R * (v / 10)] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <figure className="w-full max-w-[15rem] mx-auto">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label={`Skill profile radar. ${skills.map((k) => `${k.name} ${k.score} of 10`).join(", ")}`}
      >
        {[2, 4, 6, 8, 10].map((g) => (
          <polygon
            key={g}
            points={poly(skills.map(() => g))}
            fill="none"
            stroke="rgb(var(--ink) / 0.12)"
            strokeWidth={1}
          />
        ))}
        {skills.map((_, i) => {
          const [x, y] = pt(i, 10);
          return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgb(var(--ink) / 0.12)" />;
        })}
        {compare && (
          <polygon
            points={poly(skills.map((k) => k.peer))}
            fill="none"
            stroke="rgb(var(--ink) / 0.7)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}
        <polygon
          points={poly(skills.map((k) => k.score))}
          fill="rgb(var(--accent-rgb) / 0.22)"
          stroke="var(--brand)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {skills.map((k, i) => {
          const [x, y] = pt(i, k.score);
          return (
            <circle
              key={k.name}
              cx={x}
              cy={y}
              r={3.5}
              fill={bandFor(k.score).color}
              stroke="var(--surface)"
              strokeWidth={1.5}
            />
          );
        })}
        {skills.map((k, i) => {
          const [x, y] = pt(i, 12.6);
          const words = k.name.split(" ");
          const mid = Math.ceil(words.length / 2);
          const lines =
            words.length > 1 ? [words.slice(0, mid).join(" "), words.slice(mid).join(" ")] : [k.name];
          return (
            <text
              key={k.name}
              x={x}
              y={y - (lines.length - 1) * 5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9.5}
              fill="rgb(var(--ink) / 0.8)"
            >
              {lines.map((l, li) => (
                <tspan key={li} x={x} dy={li ? 11 : 0}>
                  {l}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      {compare && (
        <figcaption className="flex justify-center gap-4 text-[11px] text-ink/75 mt-1">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="w-3 h-0.5 bg-[var(--brand)]" />
            You
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="w-3 border-t border-dashed border-ink/70" />
            Peers
          </span>
        </figcaption>
      )}
    </figure>
  );
}

import type { TurnMark } from "../domain/report";
import BandChip from "./BandChip";

// The evidence behind a transcript turn: each indicator it touched and the band it reached.
// Gaps come first so a concession is never hidden behind a strength on the same turn.
export default function MarkList({ marks, align = "start" }: { marks: TurnMark[]; align?: "start" | "end" }) {
  if (!marks.length) return null;
  return (
    <ul
      className={`flex flex-wrap gap-1.5 ${align === "end" ? "justify-end" : ""}`}
      aria-label="Behaviours shown in this turn"
    >
      {marks.map((m) => (
        <li
          key={`${m.indicatorId}-${m.band}`}
          className="inline-flex items-center gap-1.5 text-xs text-ink/85 pl-0.5 pr-2 py-0.5 rounded-full border border-ink/15"
          style={{ background: "var(--surface)" }}
        >
          <BandChip band={m.band} />
          <span>{m.label}</span>
        </li>
      ))}
    </ul>
  );
}

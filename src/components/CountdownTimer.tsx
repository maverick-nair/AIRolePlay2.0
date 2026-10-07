import { useEffect, useRef, useState } from "react";

// Owns its own interval so the per-second tick re-renders only the timer, not the whole call.
// Warnings at five minutes and one minute are announced to screen readers and change the timer's
// shape as well as its colour, so they never rely on colour alone.
const WARNINGS = [
  { at: 300, text: "Five minutes left" },
  { at: 60, text: "One minute left" },
];

export default function CountdownTimer({ initial, onExpire }: { initial: number; onExpire?: () => void }) {
  const [t, setT] = useState(initial);
  const [announce, setAnnounce] = useState("");
  const fired = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    const id = setInterval(() => setT((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const w = WARNINGS.find((x) => x.at === t && x.at < initial);
    if (w) setAnnounce(w.text);
    if (t === 0 && !fired.current) {
      fired.current = true;
      setAnnounce("Time is up");
      expire.current?.();
    }
  }, [t, initial]);
  const mins = String(Math.floor(t / 60)).padStart(2, "0");
  const secs = String(t % 60).padStart(2, "0");
  const level = t <= 60 ? "critical" : t <= 300 ? "warning" : "normal";
  return (
    <div
      className="h-11 flex items-center gap-2 px-3 rounded-[var(--radius-sm)] border"
      style={{
        borderColor:
          level === "critical" ? "var(--danger)" : level === "warning" ? "var(--line)" : "var(--edge)",
        background:
          level === "critical" ? "color-mix(in srgb, var(--danger) 10%, var(--surface))" : undefined,
        color: level === "critical" ? "var(--danger)" : "rgb(var(--ink) / 0.8)",
      }}
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 6v3.2l2 1.3M6 1.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Time remaining</span>
      <span
        className="font-semibold text-base tabular-nums"
        style={{
          fontFamily: "var(--font-mono)",
          color: level === "critical" ? "var(--danger)" : "rgb(var(--ink))",
        }}
      >
        {mins}:{secs}
      </span>
      <span className="sr-only" role="status" aria-live="assertive">
        {announce}
      </span>
    </div>
  );
}

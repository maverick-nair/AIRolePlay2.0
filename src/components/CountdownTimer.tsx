import { useEffect, useRef, useState } from "react";

// Owns its own interval so the per-second tick re-renders only these two lines,
// not the entire session view (video, panels, leaderboard, transcript).
export default function CountdownTimer({ initial, onExpire }: { initial: number; onExpire?: () => void }) {
  const [t, setT] = useState(initial);
  const fired = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    const id = setInterval(() => setT((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (t === 0 && !fired.current) {
      fired.current = true;
      expire.current?.();
    }
  }, [t]);
  const mins = String(Math.floor(t / 60)).padStart(2, "0");
  const secs = String(t % 60).padStart(2, "0");
  const low = t <= 60;
  return (
    <div className="flex flex-col items-center pr-2 mr-1 border-r border-ink/10">
      <span className="hidden sm:inline text-ink/70 text-xs font-medium tracking-widest uppercase font-display">
        Remaining
      </span>
      <span
        className="font-display font-bold text-base tracking-wide tabular-nums"
        style={{ color: low ? "var(--danger)" : "rgb(var(--ink))" }}
        aria-live={low ? "polite" : "off"}
      >
        {mins}:{secs}
      </span>
    </div>
  );
}

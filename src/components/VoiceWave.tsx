import { useEffect, useRef } from "react";
import { reduceMotion } from "../lib/motion";

// Live voice meter: bar heights follow a smoothed random signal each frame while active,
// so it reads as real speech rather than a looping CSS wave.
export default function VoiceWave({
  active,
  color,
  bars = 24,
  className = "",
}: {
  active: boolean;
  color: string;
  bars?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    if (!active || reduceMotion()) {
      kids.forEach((k) => (k.style.transform = `scaleY(${active ? 0.5 : 0.12})`));
      return;
    }
    const lv = kids.map(() => 0.2);
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 1;
      // Syllable envelope plus per-bar jitter; occasional dips mimic pauses between words.
      const env = 0.55 + 0.45 * Math.sin(t / 6) * Math.sin(t / 17);
      const pause = Math.sin(t / 40) > 0.85 ? 0.25 : 1;
      kids.forEach((k, i) => {
        const centre = 1 - Math.abs(i - bars / 2) / (bars / 1.6);
        const target = Math.max(0.1, Math.min(1, env * pause * centre * (0.5 + Math.random() * 0.8)));
        lv[i] += (target - lv[i]) * 0.35;
        k.style.transform = `scaleY(${lv[i].toFixed(3)})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, bars]);
  return (
    <span
      ref={ref}
      aria-hidden
      className={`inline-flex items-center justify-center gap-[3px] h-10 ${className}`}
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="w-[3px] h-full rounded-full origin-center transition-opacity"
          style={{ background: color, transform: "scaleY(0.12)", opacity: active ? 1 : 0.35 }}
        />
      ))}
    </span>
  );
}

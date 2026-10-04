import { useState } from "react";
import { reduceMotion } from "../lib/motion";

const CONFETTI_COLORS = ["#ff8a4c", "#c2410c", "#efc23a", "#8dc063", "#fb7185", "#ffffff", "#e8420f"];

// Full-screen confetti cannon. Re-key it to fire again.
// Without an origin it fountains up from the lower centre; with one (viewport px) it
// bursts outward from that point, so celebrations land where the achievement is shown.
export default function ConfettiBurst({
  pieces = 90,
  origin,
}: {
  pieces?: number;
  origin?: { x: number; y: number };
}) {
  const [bits] = useState(() =>
    Array.from({ length: pieces }, (_, i) => {
      const a = origin ? Math.random() * Math.PI * 2 : (-90 + (Math.random() - 0.5) * 150) * (Math.PI / 180);
      const v = origin ? 60 + Math.random() * 220 : 260 + Math.random() * 380;
      return {
        i,
        x: 50 + (Math.random() - 0.5) * 10,
        dx: Math.cos(a) * v,
        dy: Math.sin(a) * v,
        rot: (Math.random() - 0.5) * 1080,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        d: 1.4 + Math.random() * 1.1,
        delay: Math.random() * 0.12,
        round: Math.random() > 0.7,
      };
    }),
  );
  if (reduceMotion()) return null;
  return (
    <div aria-hidden className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {bits.map((b) => (
        <span
          key={b.i}
          className="absolute confetti-piece"
          style={{
            left: origin ? origin.x : `${b.x}%`,
            top: origin ? origin.y : "58%",
            width: b.w,
            height: b.round ? b.w : b.h,
            borderRadius: b.round ? 999 : 2,
            background: b.c,
            ["--dx" as string]: `${b.dx}px`,
            ["--dy" as string]: `${b.dy}px`,
            ["--rot" as string]: `${b.rot}deg`,
            animationDuration: `${b.d}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

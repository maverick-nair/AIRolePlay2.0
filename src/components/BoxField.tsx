import { useEffect, useRef, useState } from "react";

// Live tile field: a grid of cells over the static box pattern. Cells breathe on staggered
// timers, a diagonal wave sweeps the grid, and a soft spotlight trails the pointer.
const TILE = 72;
export default function BoxField() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ cols: 0, rows: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setDims({
        cols: Math.ceil(el.clientWidth / TILE),
        rows: Math.min(14, Math.ceil(el.clientHeight / TILE)),
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const host = el.parentElement;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
      el.style.setProperty("--spot", "1");
    };
    const leave = () => el.style.setProperty("--spot", "0");
    host?.addEventListener("pointermove", move);
    host?.addEventListener("pointerleave", leave);
    return () => {
      ro.disconnect();
      host?.removeEventListener("pointermove", move);
      host?.removeEventListener("pointerleave", leave);
    };
  }, []);
  // Deterministic pseudo-random so the layout is stable across renders.
  const rnd = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const cells = [];
  for (let y = 0; y < dims.rows; y++)
    for (let x = 0; x < dims.cols; x++) {
      const i = y * dims.cols + x;
      const live = rnd(i + 1) > 0.72;
      cells.push(
        <span
          key={i}
          className={live ? "box-cell box-cell--live" : "box-cell"}
          style={{
            left: x * TILE,
            top: y * TILE,
            animationDelay: live
              ? `${(rnd(i + 7) * 9).toFixed(2)}s, ${((x + y) * 0.12).toFixed(2)}s`
              : `${((x + y) * 0.12).toFixed(2)}s`,
            animationDuration: live ? `${(5 + rnd(i + 3) * 6).toFixed(2)}s, 9s` : "9s",
          }}
        />,
      );
    }
  return (
    <div ref={ref} aria-hidden className="box-field">
      {cells}
      <span className="box-spot" />
    </div>
  );
}

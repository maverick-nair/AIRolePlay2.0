import type { ReactNode } from "react";

// One small stroke icon set for both products, drawn on a 24 grid. Decorative by default: give the
// control around it an accessible name.
const PATHS: Record<string, ReactNode> = {
  home: <path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />,
  path: (
    <>
      <path d="M5 19c4 0 3-6 7-6s3-6 7-6" />
      <circle cx="5" cy="19" r="1.8" />
      <circle cx="19" cy="7" r="1.8" />
    </>
  ),
  report: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  brief: (
    <>
      <path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5M9 2h6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  attempts: (
    <>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v4h4" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  trophy: (
    <>
      <path d="M7 4h10v4a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  bulb: (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" />
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  share: <path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />,
  quest: (
    <>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </>
  ),
};

export default function Icon({
  name,
  size = 20,
  stroke = 2,
  className,
  filled,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  stroke?: number;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

// Filled glyphs for the game layer: a flame for streaks, a star for XP.
export function FlameGlyph({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2c1 4 5 5.5 5 10.5A5 5 0 0 1 7 12.5c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9z" />
    </svg>
  );
}
export function StarGlyph({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z" />
    </svg>
  );
}

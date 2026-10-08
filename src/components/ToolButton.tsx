import { type ReactNode } from "react";

// Compact, tactile control with a hover tooltip and an optional count badge.
export default function ToolButton({
  active,
  onClick,
  label,
  badge,
  badgeColor,
  badgeText = "#0c0c0f",
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  badge?: ReactNode;
  badgeColor?: string;
  badgeText?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        aria-label={badge !== null && badge !== undefined ? `${label} ${badge}` : label}
        aria-pressed={active}
        className="tool-btn relative w-10 h-10 flex items-center justify-center"
        style={{
          background: active ? "rgb(var(--accent-rgb) / 0.16)" : "rgb(var(--ink) / 0.05)",
          color: active ? "var(--brand)" : "rgb(var(--ink) / 0.7)",
          border: active ? "1px solid rgb(var(--accent-rgb) / 0.45)" : "1px solid rgb(var(--ink) / 0.1)",
          boxShadow: active ? "0 0 0 3px rgb(var(--accent-rgb) / 0.1)" : "none",
        }}
      >
        {children}
        {badge !== null && badge !== undefined && (
          <span
            key={String(badge)}
            className="badge-pop absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-bold font-display rounded-full tabular-nums"
            style={{
              background: badgeColor ?? "var(--brand)",
              color: badgeText,
            }}
          >
            {badge}
          </span>
        )}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs font-display rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-hover:[animation:tip-in_0.15s_ease-out] z-50"
        style={{ background: "rgb(var(--ink) / 0.92)", color: "var(--bg)" }}
      >
        {label}
      </span>
    </div>
  );
}

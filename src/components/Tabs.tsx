import { useRef, type KeyboardEvent } from "react";

// Segmented tabs following the WAI-ARIA tabs pattern: one tab stop, arrow keys move between tabs,
// Home and End jump to the ends. Panels are rendered by the caller with the matching ids.
export default function Tabs<T extends string>({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
  className = "",
}: {
  label: string;
  idPrefix: string;
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? i === last
          ? 0
          : i + 1
        : e.key === "ArrowLeft"
          ? i === 0
            ? last
            : i - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`seg ${className}`}>
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => move(e, i)}
            className="transition-colors"
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function tabPanelProps(idPrefix: string, id: string) {
  return {
    role: "tabpanel" as const,
    id: `${idPrefix}-panel-${id}`,
    "aria-labelledby": `${idPrefix}-tab-${id}`,
    tabIndex: 0,
  };
}

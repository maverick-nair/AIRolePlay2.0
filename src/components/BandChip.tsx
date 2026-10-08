import type { Band } from "../domain/scenario";
import { readableOn } from "../lib/color";

// Colours for behavioural bands reuse the Knolskape palette so bands and scores read as one system.
export const BAND_COLORS: Record<Band, string> = {
  Strong: "#2f7a34",
  Adequate: "#8dc063",
  Weak: "#e07b2e",
  Harmful: "#b5472f",
};

export default function BandChip({ band, size = "sm" }: { band: Band | null; size?: "sm" | "md" }) {
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs";
  if (!band)
    return (
      <span
        className={`inline-flex flex-none items-center whitespace-nowrap rounded-full font-display font-semibold ${pad} border border-ink/20 text-ink/75`}
      >
        Not observed
      </span>
    );
  return (
    <span
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-full font-display font-semibold ${pad}`}
      style={{ background: BAND_COLORS[band], color: readableOn(BAND_COLORS[band]) }}
    >
      {band}
    </span>
  );
}

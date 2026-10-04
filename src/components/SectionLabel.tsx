import { type ReactNode } from "react";

export default function SectionLabel({ index, children }: { index: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="font-display text-xs font-semibold tracking-[0.2em] text-brand tabular-nums">
        {index}
      </span>
      <span className="h-px flex-none w-6 bg-ink/15" />
      <h2 className="font-display font-semibold text-ink text-base tracking-tight">{children}</h2>
    </div>
  );
}

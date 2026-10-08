import type { ReactNode } from "react";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icon";
import type { Product } from "../products";

const BUILD: string = import.meta.env.VITE_BUILD ?? "dev";

export type RailItem = { id: string; label: string; icon: string; current?: boolean; onSelect: () => void };

// The frame both products share: a slim icon rail and a soft grey ground holding white cards. From
// md up the page is one fixed frame (a cockpit): the rail runs down the left edge and the content fills
// the rest of the viewport, so nothing needs a scroll on a laptop or tablet. If a window is smaller than
// the layouts were built for, the content area scrolls as a fallback rather than clipping anything.
// On phones the rail is a top bar and the page scrolls as normal. Every rail control has a visible
// focus ring, a 44px target and an accessible name; the current page is marked with aria-current.
export default function AppShell({
  product,
  items = [],
  children,
}: {
  product: Product;
  items?: RailItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-full md:h-full flex flex-col md:flex-row" style={{ background: "var(--bg)" }}>
      <nav
        aria-label={`${product.name} navigation`}
        className="flex flex-none md:flex-col items-center gap-2 px-3 py-2 md:px-0 md:py-3 md:w-16 border-b md:border-b-0 md:border-r"
        style={{ background: "var(--surface)", borderColor: "var(--edge)" }}
      >
        <div
          className="w-11 h-11 flex-none flex items-center justify-center rounded-[12px] text-white text-sm font-bold md:mb-2"
          style={{ background: "var(--accent)" }}
        >
          <span aria-hidden>{product.mark}</span>
          <span className="sr-only">{product.name}</span>
        </div>
        <ul className="flex md:flex-col gap-2">
          {items.map((it) => (
            <li key={it.id}>
              <button
                onClick={it.onSelect}
                aria-label={it.label}
                title={it.label}
                aria-current={it.current ? "page" : undefined}
                className="rail-item"
              >
                <Icon name={it.icon} size={22} />
              </button>
            </li>
          ))}
        </ul>
        <div className="ml-auto md:ml-0 md:mt-auto flex md:flex-col items-center gap-2">
          <ThemeToggle />
          {/* Which build a page comes from, for support */}
          <p
            className="text-xs text-ink/80 leading-tight text-center tabular-nums"
            title={`${product.name} 2.0, build ${BUILD}`}
          >
            <span className="sr-only">{product.name} 2.0, build </span>
            {BUILD}
          </p>
        </div>
      </nav>
      <div className="flex-1 min-w-0 md:min-h-0 md:overflow-auto">{children}</div>
    </div>
  );
}

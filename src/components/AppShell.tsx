import type { ReactNode } from "react";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icon";
import type { Product } from "../products";

export type RailItem = { id: string; label: string; icon: string; current?: boolean; onSelect: () => void };

// The frame both products share: a slim icon rail (a top bar on small screens) and a soft grey
// ground holding white cards. Every rail control has a visible focus ring, a 44px target and an
// accessible name; the current page is marked with aria-current.
export default function AppShell({
  product,
  items = [],
  children,
  fixed = false,
  railFromLg = false,
}: {
  product: Product;
  items?: RailItem[];
  children: ReactNode;
  fixed?: boolean;
  // The call screen keeps every pixel for the stage on small screens, so its rail starts at lg.
  railFromLg?: boolean;
}) {
  return (
    <div
      className={`${fixed ? "h-full" : "min-h-full"} flex flex-col lg:flex-row`}
      style={{ background: "var(--bg)" }}
    >
      <nav
        aria-label={`${product.name} navigation`}
        className={`${railFromLg ? "hidden lg:flex" : "flex"} flex-none lg:flex-col items-center gap-2 px-3 py-2 lg:py-4 lg:w-[76px] border-b lg:border-b-0 lg:border-r lg:sticky lg:top-0 lg:h-screen`}
        style={{ background: "var(--surface)", borderColor: "var(--edge)" }}
      >
        <div
          className="w-11 h-11 flex-none flex items-center justify-center rounded-[12px] text-white text-sm font-bold lg:mb-3"
          style={{ background: "var(--accent)" }}
        >
          <span aria-hidden>{product.mark}</span>
          <span className="sr-only">{product.name}</span>
        </div>
        <ul className="flex lg:flex-col gap-2">
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
        <div className="ml-auto lg:ml-0 lg:mt-auto flex lg:flex-col items-center gap-2">
          <ThemeToggle />
        </div>
      </nav>
      <div className={`flex-1 min-w-0 ${fixed ? "min-h-0" : ""}`}>{children}</div>
    </div>
  );
}

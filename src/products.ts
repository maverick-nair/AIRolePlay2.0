import type { Mode } from "./domain/scenario";

// The two products share one engine, one scenario model and one backend, but they are separate
// interfaces with separate entry points, and neither offers the other's mode.
//   AI RolePlay      (Experience) practice: up to five runs per scenario, rewind, hints, adaptive persona
//   Conversation AI  (Evaluate)   assessment: one attempt, standardised persona, hidden criteria
export type ProductId = "roleplay" | "conversation-ai";

export type Product = {
  id: ProductId;
  name: string;
  line: "Experience" | "Evaluate";
  mode: Mode;
  tagline: string;
  mark: string;
};

export const PRODUCTS: Record<ProductId, Product> = {
  roleplay: {
    id: "roleplay",
    name: "AI RolePlay",
    line: "Experience",
    mode: "practice",
    tagline: "Practise the conversation until it holds under pressure.",
    mark: "RP",
  },
  "conversation-ai": {
    id: "conversation-ai",
    name: "Conversation AI",
    line: "Evaluate",
    mode: "assessment",
    tagline: "One standardised conversation, scored against evidence.",
    mark: "CA",
  },
};

// Lets the stylesheet give each product its own accent while every token name stays the same.
export function applyProductTheme(product: Product) {
  document.documentElement.dataset.product = product.id;
  document.title = product.name;
}

// Returns black or white, whichever meets WCAG AA contrast, for text on a solid hex fill.
export function readableOn(hex: string) {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  return L > 0.18 ? "#0c0c0f" : "#ffffff";
}

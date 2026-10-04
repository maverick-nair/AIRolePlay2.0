import type { Mode } from "../domain/scenario";

// Report ids carry the mode and the completion date. Lives outside the domain layer because it
// parses a timestamp; the domain stays free of clocks.
export default function reportId(completedAt: string, mode: Mode) {
  const d = new Date(completedAt);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const serial = String(d.getTime() % 10000).padStart(4, "0");
  return `${mode === "assessment" ? "ASM" : "PRC"}-${stamp}-${serial}`;
}

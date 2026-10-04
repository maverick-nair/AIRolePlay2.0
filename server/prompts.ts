import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { JobName } from "./llm/types";

// Prompts are versioned Markdown files under /prompts/<job>/<version>.md with front matter.
// They are the only source of prompt text; no inline prompt strings live in the server.

const here = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(here, "..", "prompts");

export type Prompt = { job: JobName; version: string; body: string };

export function loadPrompt(job: JobName, version: string): Prompt {
  const raw = readFileSync(join(PROMPTS_DIR, job, `${version}.md`), "utf8");
  return { job, version, body: raw.replace(/^---[\s\S]*?---\s*/, "") };
}

export function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
}

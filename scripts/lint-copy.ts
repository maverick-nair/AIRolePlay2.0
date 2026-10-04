// Copy lint: no em or en dashes, no "competency" wording, in any text we write.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIP = new Set(["node_modules", ".git", "dist", "coverage", "pnpm-lock.yaml", "lint-copy.ts"]);
const TEXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".css",
  ".html",
  ".example",
  "",
]);

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (TEXT.has(extname(name))) out.push(abs);
  }
  return out;
}

const problems: string[] = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file);
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/—/.test(line)) problems.push(`${rel}:${i + 1}: em dash`);
      if (/–/.test(line)) problems.push(`${rel}:${i + 1}: en dash`);
      if (/competenc/i.test(line) && !/say "skills"|never "competenc/i.test(line))
        problems.push(`${rel}:${i + 1}: say "skills", not "competency"`);
    });
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Copy lint: clean");

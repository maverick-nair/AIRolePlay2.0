import type { Register } from "claude-code";

// A git commit or push anywhere in the command: `git commit`, `git -C dir push`, `cd x && git push`.
const GIT_WRITE = /\bgit\b(?:\s+-[^\s]+(?:\s+[^\s-][^\s]*)?)*\s+(commit|push)\b/;
// A leading `cd <dir> &&` or `cd <dir>;` decides where the lint runs.
const CD_PREFIX = /^\s*cd\s+("([^"]+)"|'([^']+)'|([^\s;&|]+))\s*(?:&&|;)/;
const GIT_C = /\bgit\s+-C\s+("([^"]+)"|'([^']+)'|([^\s]+))/;

function pickDir(command: string): string | null {
  const cd = CD_PREFIX.exec(command);
  if (cd) return cd[2] ?? cd[3] ?? cd[4] ?? null;
  const c = GIT_C.exec(command);
  if (c) return c[2] ?? c[3] ?? c[4] ?? null;
  return null;
}

const join = (base: string, rel: string) =>
  rel.startsWith("/") ? rel : `${base.replace(/\/$/, "")}/${rel.replace(/^\.\//, "")}`;

export const register: Register = (on) => {
  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    const match = GIT_WRITE.exec(e.command);
    if (!match) return next(e);
    const verb = match[1];

    const base = await $.session.root();
    const picked = pickDir(e.command);
    const cwd = picked ? join(base, picked) : base;

    // Only guard projects that define the lint; anything else passes through untouched.
    const hasLint = await $.fs
      .read(`${cwd}/package.json`)
      .then((text) => {
        const pkg = JSON.parse(text) as { scripts?: Record<string, string> };
        return typeof pkg.scripts?.["lint:copy"] === "string";
      })
      .catch(() => false);
    if (!hasLint) return next(e);

    $.ui.status(`copy lint before git ${verb}`);
    const ran = await $.process.run(["pnpm", "lint:copy"], { cwd, timeoutMs: 120_000 });
    $.ui.status(undefined);

    if (ran.exitCode === 0) return next(e);

    const detail = `${ran.stdout}\n${ran.stderr}`
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 12)
      .join("\n");
    $.ui.toast(`${$.plugin.name}: copy lint failed, git ${verb} blocked`);
    return {
      deny: `${$.plugin.name}: pnpm lint:copy failed in ${cwd}, so git ${verb} was not run. Fix the copy (no em or en dashes, say "skills") and try again.\n${detail}`,
    };
  }).catch(($, e, next) =>
    next.called
      ? next(e)
      : {
          deny: `${$.plugin.name}: the copy lint guard could not run (is pnpm installed and the project installed?). The git command was not run.`,
        },
  );
};

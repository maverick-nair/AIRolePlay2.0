import type { Register } from "claude-code";

const GIT_PUSH = /\bgit\b(?:\s+-[^\s]+(?:\s+[^\s-][^\s]*)?)*\s+push\b/;
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
    if (!GIT_PUSH.test(e.command)) return next(e);

    const base = await $.session.root();
    const picked = pickDir(e.command);
    const cwd = picked ? join(base, picked) : base;

    // Only projects that define `check` are guarded.
    const hasCheck = await $.fs
      .read(`${cwd}/package.json`)
      .then(
        (text) =>
          typeof (JSON.parse(text) as { scripts?: Record<string, string> }).scripts?.check === "string",
      )
      .catch(() => false);
    if (!hasCheck) return next(e);

    $.ui.status("pnpm check before git push");
    // Typecheck, lint, tests and a build can take a while; ten minutes is the engine's ceiling.
    const ran = await $.process.run(["pnpm", "check"], { cwd, timeoutMs: 600_000 });
    $.ui.status(undefined);
    if (ran.exitCode === 0) return next(e);

    const tail = `${ran.stdout}\n${ran.stderr}`
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith(">"))
      .slice(-20)
      .join("\n");
    $.ui.toast(`${$.plugin.name}: pnpm check failed, push blocked`);
    return {
      deny: `${$.plugin.name}: pnpm check failed in ${cwd}, so git push was not run. Fix the failure and push again.\n${tail}`,
    };
  }).catch(($, e, next) =>
    next.called
      ? next(e)
      : {
          deny: `${$.plugin.name}: pnpm check could not run (is the project installed?), so git push was not run.`,
        },
  );
};

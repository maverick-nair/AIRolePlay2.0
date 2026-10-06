import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";

const PKG_WITH_LINT = JSON.stringify({ scripts: { "lint:copy": "tsx scripts/lint-copy.ts" } });
const PKG_WITHOUT = JSON.stringify({ scripts: { build: "vite build" } });

function world(on: On, opts: { pkg: string | null; exitCode: number; out?: string }) {
  const runs: { argv: readonly string[]; cwd?: string }[] = [];
  on("session.root", async () => ({ value: "/repo" }));
  on("ui.status", async () => ({ value: undefined }));
  on("ui.toast", async () => ({ value: undefined }));
  on("fs.read", async () => (opts.pkg === null ? { deny: "ENOENT: no package.json" } : { value: opts.pkg }));
  on("process.run", async (_$, e) => {
    runs.push({ argv: e.argv, cwd: e.init?.cwd });
    return {
      value: {
        exitCode: opts.exitCode,
        stdout: opts.out ?? "",
        stderr: "",
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    };
  });
  const bash: string[] = [];
  on("tool.call", { tool: "Bash" }, async (_$, e) => {
    bash.push(e.command);
    return { result: { stdout: "ok", stderr: "" } };
  });
  return { runs, bash };
}

test("blocks git commit when lint:copy fails", async ($, on) => {
  const w = world(on, { pkg: PKG_WITH_LINT, exitCode: 1, out: "docs/x.md:3: em dash" });
  const r = await $.tool.call({ tool: "Bash", command: 'git commit -m "x"' });
  // The engine's own caller sees the refusal as `{ deny }`; a session's hooks see it as an errored result.
  const reason = r.deny ?? (r.isError ? r.text : undefined);
  expect(reason).toContain("lint:copy failed");
  expect(reason).toContain("em dash");
  expect(w.bash).toEqual([]);
  expect(w.runs[0].argv).toEqual(["pnpm", "lint:copy"]);
  expect(w.runs[0].cwd).toBe("/repo");
});

test("lets git push through when lint:copy passes", async ($, on) => {
  const w = world(on, { pkg: PKG_WITH_LINT, exitCode: 0 });
  const r = await $.tool.call({ tool: "Bash", command: "git push -u origin main" });
  expect(r.isError).toBeFalsy();
  expect(w.bash).toEqual(["git push -u origin main"]);
  expect(w.runs.length).toBe(1);
});

test("runs the lint in the directory a leading cd names", async ($, on) => {
  const w = world(on, { pkg: PKG_WITH_LINT, exitCode: 0 });
  await $.tool.call({ tool: "Bash", command: 'cd apps/web && git commit -am "y"' });
  expect(w.runs[0].cwd).toBe("/repo/apps/web");
});

test("ignores projects without a lint:copy script and non git commands", async ($, on) => {
  const w = world(on, { pkg: PKG_WITHOUT, exitCode: 1 });
  await $.tool.call({ tool: "Bash", command: 'git commit -m "z"' });
  await $.tool.call({ tool: "Bash", command: "git status" });
  await $.tool.call({ tool: "Bash", command: "pnpm test" });
  expect(w.runs).toEqual([]);
  expect(w.bash).toEqual(['git commit -m "z"', "git status", "pnpm test"]);
});

test("passes through when there is no package.json at all", async ($, on) => {
  const w = world(on, { pkg: null, exitCode: 1 });
  await $.tool.call({ tool: "Bash", command: "git push" });
  expect(w.runs).toEqual([]);
  expect(w.bash).toEqual(["git push"]);
});

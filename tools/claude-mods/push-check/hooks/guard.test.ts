import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";

const PKG = JSON.stringify({ scripts: { check: "pnpm typecheck && pnpm test" } });

function world(on: On, opts: { pkg: string | null; exitCode: number; out?: string }) {
  const runs: { argv: readonly string[]; cwd?: string; timeoutMs?: number }[] = [];
  const bash: string[] = [];
  on("session.root", async () => ({ value: "/repo" }));
  on("ui.status", async () => ({ value: undefined }));
  on("ui.toast", async () => ({ value: undefined }));
  on("fs.read", async () => (opts.pkg === null ? { deny: "ENOENT" } : { value: opts.pkg }));
  on("process.run", async (_$, e) => {
    runs.push({ argv: e.argv, cwd: e.init?.cwd, timeoutMs: e.init?.timeoutMs });
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
  on("tool.call", { tool: "Bash" }, async (_$, e) => {
    bash.push(e.command);
    return { result: { stdout: "", stderr: "" } };
  });
  return { runs, bash };
}
const reason = (r: { deny?: string; isError?: boolean; text?: string }) =>
  r.deny ?? (r.isError ? r.text : undefined);

test("blocks a push when pnpm check fails and shows the tail of the output", async ($, on) => {
  const w = world(on, {
    pkg: PKG,
    exitCode: 1,
    out: "> pnpm typecheck\nsrc/a.ts(3,1): error TS2322\n ELIFECYCLE  Command failed",
  });
  const r = await $.tool.call({ tool: "Bash", command: "git push -u origin main" });
  expect(reason(r)).toContain("pnpm check failed");
  expect(reason(r)).toContain("TS2322");
  expect(w.bash).toEqual([]);
  expect(w.runs[0].argv).toEqual(["pnpm", "check"]);
  expect(w.runs[0].timeoutMs).toBe(600_000);
});

test("lets the push through when the check passes, in the directory a cd names", async ($, on) => {
  const w = world(on, { pkg: PKG, exitCode: 0 });
  await $.tool.call({ tool: "Bash", command: "cd apps/web && git push" });
  expect(w.runs[0].cwd).toBe("/repo/apps/web");
  expect(w.bash).toEqual(["cd apps/web && git push"]);
});

test("ignores commits, other commands and projects without a check script", async ($, on) => {
  const w = world(on, { pkg: JSON.stringify({ scripts: { build: "vite build" } }), exitCode: 1 });
  await $.tool.call({ tool: "Bash", command: 'git commit -m "x"' });
  await $.tool.call({ tool: "Bash", command: "git push" });
  await $.tool.call({ tool: "Bash", command: "pnpm test" });
  expect(w.runs).toEqual([]);
  expect(w.bash.length).toBe(3);
});

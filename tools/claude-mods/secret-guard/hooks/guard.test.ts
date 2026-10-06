import type { On } from "claude-code";
import { expect, test } from "claude-code/testing";

type Git = { names?: string; patch?: string };

function world(on: On, git: Git = {}) {
  const bash: string[] = [];
  on("session.root", async () => ({ value: "/repo" }));
  on("ui.toast", async () => ({ value: undefined }));
  on("process.run", async (_$, e) => {
    const argv = e.argv.join(" ");
    const isNames = argv.includes("--name-only");
    return {
      value: {
        exitCode: 0,
        stdout: isNames ? (git.names ?? "") : (git.patch ?? ""),
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
  return { bash };
}
const reason = (r: { deny?: string; isError?: boolean; text?: string }) =>
  r.deny ?? (r.isError ? r.text : undefined);

test("refuses a command that carries a literal API key", async ($, on) => {
  const w = world(on);
  const r = await $.tool.call({
    tool: "Bash",
    command: "ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123 pnpm server",
  });
  expect(reason(r)).toContain("Anthropic API key");
  expect(w.bash).toEqual([]);
});

test("refuses staging a .env file but allows .env.example", async ($, on) => {
  const w = world(on);
  const r = await $.tool.call({ tool: "Bash", command: 'git add .env.local && git commit -m "x"' });
  expect(reason(r)).toContain("never committed");
  await $.tool.call({ tool: "Bash", command: "git add .env.example" });
  expect(w.bash).toEqual(["git add .env.example"]);
});

test("blocks a commit whose index holds a .env file", async ($, on) => {
  const w = world(on, { names: "src/a.ts\napps/x/.env\n", patch: "" });
  const r = await $.tool.call({ tool: "Bash", command: 'git commit -m "oops"' });
  expect(reason(r)).toContain("apps/x/.env");
  expect(w.bash).toEqual([]);
});

test("blocks a commit whose staged changes add a secret value", async ($, on) => {
  const w = world(on, { names: "server/config.ts\n", patch: '+const key = "AKIAABCDEFGHIJKLMNOP"\n' });
  const r = await $.tool.call({ tool: "Bash", command: 'git commit -m "oops"' });
  expect(reason(r)).toContain("AWS access key id");
  expect(w.bash).toEqual([]);
});

test("lets a clean commit and a clean push through, including empty variable names", async ($, on) => {
  const w = world(on, {
    names: ".env.example\nREADME.md\n",
    patch: "+ANTHROPIC_API_KEY=\n+LLM_ROUTE_DEFAULT=mock\n+-- removed: ---\n",
  });
  await $.tool.call({ tool: "Bash", command: 'git commit -m "docs"' });
  await $.tool.call({ tool: "Bash", command: "git push origin main" });
  expect(w.bash).toEqual(['git commit -m "docs"', "git push origin main"]);
});

test("scans unpushed commits before a push", async ($, on) => {
  const w = world(on, {
    names: "notes.md\n",
    patch: "+token: ghp_abcdefghijklmnopqrstuvwxyz0123456789ABCD\n",
  });
  const r = await $.tool.call({ tool: "Bash", command: "cd apps/web && git push" });
  expect(reason(r)).toContain("GitHub token");
  expect(w.bash).toEqual([]);
});

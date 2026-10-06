import type { Register } from "claude-code";

// What a secret looks like, in a command line or in a diff. Patterns match values, never names,
// so `ANTHROPIC_API_KEY=` in .env.example (empty) or in docs is fine.
const SECRET_VALUE: { name: string; rx: RegExp }[] = [
  { name: "Anthropic API key", rx: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI style key", rx: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "AWS access key id", rx: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Google API key", rx: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "GitHub token", rx: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "private key block", rx: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "credential assignment", rx: /\b[A-Z_]*(API_KEY|AUTH_TOKEN|SECRET|PASSWORD)=["']?[^\s"'$]{16,}/ },
];
// .env files that must never be committed. .env.example is the documented exception.
const ENV_FILE = /(^|\/)\.env(\.(?!example$)[^\s/]+)?$/;
const GIT_ADD_ENV = /\bgit\b[^|;&]*\badd\b[^|;&]*(^|\s|\/)\.env(\.(?!example\b)[^\s]*)?(\s|$)/;
const GIT_WRITE = /\bgit\b(?:\s+-[^\s]+(?:\s+[^\s-][^\s]*)?)*\s+(commit|push)\b/;
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

function findSecret(text: string): string | null {
  for (const s of SECRET_VALUE) if (s.rx.test(text)) return s.name;
  return null;
}

export const register: Register = (on) => {
  on("tool.call", { tool: "Bash" }, async ($, e, next) => {
    const name = $.plugin.name;

    // 1. A literal secret in the command itself never runs: it would land in the transcript and logs.
    const inCommand = findSecret(e.command);
    if (inCommand) {
      $.ui.toast(`${name}: command carried a ${inCommand}`);
      return {
        deny: `${name}: the command contains what looks like a ${inCommand}. This product runs without keys in the process; put credentials in a gitignored .env or the environment, never on a command line.`,
      };
    }

    // 2. Staging a .env file is refused outright.
    if (GIT_ADD_ENV.test(e.command)) {
      return {
        deny: `${name}: .env files are never committed. Only .env.example belongs in the repository.`,
      };
    }

    // 3. Before a commit or push, scan what would leave the machine.
    const match = GIT_WRITE.exec(e.command);
    if (!match) return next(e);
    const verb = match[1];
    const base = await $.session.root();
    const picked = pickDir(e.command);
    const cwd = picked ? join(base, picked) : base;

    const names =
      verb === "commit"
        ? await $.process.run(["git", "diff", "--cached", "--name-only"], { cwd })
        : await $.process.run(
            ["git", "log", "--name-only", "--format=", "-n", "50", "HEAD", "--not", "--remotes"],
            { cwd },
          );
    if (names.exitCode === 0) {
      const envFile = names.stdout
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && ENV_FILE.test(l));
      if (envFile) {
        $.ui.toast(`${name}: ${envFile} blocked`);
        return {
          deny: `${name}: ${envFile} is about to be ${verb === "commit" ? "committed" : "pushed"}. Remove it from the history or the index first; .env files never leave the machine.`,
        };
      }
    }

    const patch =
      verb === "commit"
        ? await $.process.run(["git", "diff", "--cached", "-U0"], { cwd, timeoutMs: 60_000 })
        : await $.process.run(
            ["git", "log", "-p", "-U0", "--format=%H", "-n", "50", "HEAD", "--not", "--remotes"],
            { cwd, timeoutMs: 60_000 },
          );
    if (patch.exitCode === 0) {
      const added = patch.stdout
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .join("\n");
      const found = findSecret(added);
      if (found) {
        $.ui.toast(`${name}: ${found} in the diff, git ${verb} blocked`);
        return {
          deny: `${name}: a ${found} appears in the changes about to be ${verb === "commit" ? "committed" : "pushed"}. Remove the value (keep the variable name, leave the value empty) and try again.`,
        };
      }
    }

    return next(e);
  }).catch(($, e, next) =>
    next.called
      ? next(e)
      : { deny: `${$.plugin.name}: the secret guard could not run, so the command was not run.` },
  );
};

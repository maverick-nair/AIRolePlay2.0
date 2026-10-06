# push-check

A Claude Code mod for this repository. Before any `git push` that Claude runs through Bash, it runs `pnpm check` (typecheck, lint, copy lint, format check, tests, build) in the project the command targets. If the check fails, the push is refused and the last lines of the output are shown. Projects without a `check` script pass through, as do commits and every other command.

The check can take a few minutes; the status line shows it running and the engine allows up to ten minutes.

Install:

```
/plugin install push-check --marketplace maverick-nair/AIRolePlay2.0
```

Develop or test from a checkout: `claude plugin validate tools/claude-mods/push-check` and `claude plugin test tools/claude-mods/push-check`.

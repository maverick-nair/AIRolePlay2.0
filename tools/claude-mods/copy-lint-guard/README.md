# copy-lint-guard

A Claude Code mod for this repository. Before any `git commit` or `git push` that Claude runs through Bash, it runs `pnpm lint:copy` in the project the command targets (a leading `cd dir &&` or `git -C dir` is honoured). If the copy rules fail (an em or en dash, or the banned wording that the project replaces with "skills"), the git command is refused and the lint output is shown, so bad copy never reaches the branch. Projects without a `lint:copy` script, and every other command, pass through untouched.

Install from this repository's marketplace:

```
/plugin install copy-lint-guard --marketplace maverick-nair/AIRolePlay2.0
```

Answer `y` to add the marketplace, then pick a scope. The guard is active in that session at once and in every later session under the user scope.

Develop or test it from a checkout:

```
claude --plugin-dir tools/claude-mods/copy-lint-guard
claude plugin validate tools/claude-mods/copy-lint-guard
claude plugin test tools/claude-mods/copy-lint-guard
```

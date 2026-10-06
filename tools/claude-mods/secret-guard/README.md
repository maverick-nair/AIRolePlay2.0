# secret-guard

A Claude Code mod for this repository. It keeps credentials out of commands, commits and pushes that Claude runs through Bash:

- A command that carries a literal secret value (an Anthropic, OpenAI, AWS, Google or GitHub key, a private key block, or `SOMETHING_API_KEY=<value>`) is refused before it runs. This product runs without keys in the process; credentials belong in a gitignored `.env` or the environment, never on a command line.
- `git add` of a `.env` file is refused. `.env.example` is the documented exception.
- Before `git commit`, the staged files and the staged diff are scanned; before `git push`, the unpushed commits are. A `.env` file or a secret looking value in added lines blocks the command and names what was found. Variable names with empty values pass.

Install:

```
/plugin install secret-guard --marketplace maverick-nair/AIRolePlay2.0
```

Develop or test from a checkout: `claude plugin validate tools/claude-mods/secret-guard` and `claude plugin test tools/claude-mods/secret-guard`.

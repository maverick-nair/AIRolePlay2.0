# AI RolePlay 2.0

Two products for workplace conversations, built on one evidence based instrument, one scoring engine and one backend. Each has its own interface and entry point, and neither offers the other's mode:

| Product | 4E line | Entry | What it does |
| --- | --- | --- | --- |
| **AI RolePlay** | Experience | `/` (`index.html`) | Practice: up to five runs per scenario, rewind any of your turns (the persona rewinds with you), criteria on request, hints in the moment, selectable persona difficulty, and a trend across runs. Scores are for the learner. |
| **Conversation AI** | Evaluate | `/assess/` (`assess/index.html`) | Assessment: one attempt, a fixed time limit, a standardised persona that follows a schedule of critical incidents, hidden criteria, no hints, no rewind, and a confirmation before the attempt starts. The report is saved and the scenario locks. |

Every score is produced the same way in both products. A classifier (an LLM, or the offline heuristic) places each participant turn into a band (Strong, Adequate, Weak, Harmful) against authored behavioural indicators with written anchors, quoting the words that justify it. Rules turn bands into points through a fixed table. No model ever writes a number into a score. Every rating traces to quoted turns, and every report states where the instrument sits on the claim ladder (rung 1 of 4 today: structured feedback, not for talent decisions).

The first scenario is a renewal negotiation with Margaret Hale, VP Procurement at Northwind Freight.

## Quick start

Node 22 and pnpm 10.

```
pnpm install
pnpm dev            # offline: scripted persona, heuristic classifier, template report writer
                    # AI RolePlay at http://localhost:5173/  Conversation AI at http://localhost:5173/assess/
```

To run with Claude, pick the authentication that matches your environment. No API key is required:

```
cp .env.example .env
# Internal gateway (no credential in this process):
#   LLM_AUTH_MODE=gateway  ANTHROPIC_BASE_URL=https://llm-gateway.internal/anthropic
#   LLM_ROUTE_DEFAULT=anthropic:claude-opus-5-5
# Or Bedrock with IAM:   LLM_BEDROCK_REGION=us-east-1  LLM_ROUTE_DEFAULT=bedrock:anthropic.claude-opus-5-5
# Or Vertex with ADC:    LLM_VERTEX_REGION=global LLM_VERTEX_PROJECT_ID=p  LLM_ROUTE_DEFAULT=vertex:claude-opus-5-5
# Or a bearer token / API key in env mode: ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY
pnpm server         # API server on :8787, prints the routing table and auth mode at startup
pnpm dev:ai         # Vite with VITE_AI_PROVIDER=http, proxies /api to the server
```

`pnpm check` runs typecheck, lint, copy lint, format check, tests and build. CI runs the same.

## LLM routing

Every AI job in the backend (`npc` persona, `classify` turn classifier, `report` writer) is routed independently through environment variables, so cost, speed, security and accuracy decisions are configuration, not code:

```
LLM_ROUTE_<JOB>=provider:model[:effort]     # e.g. LLM_ROUTE_CLASSIFY=anthropic:claude-opus-5-5:medium
LLM_ROUTE_DEFAULT=...                       # for jobs without their own route; mock = offline
LLM_FALLBACK_<JOB>=...                      # tried when the primary route errors or refuses
PROMPT_VERSION_<JOB>=v1                     # prompt file under prompts/<job>/
ROLEPLAY_DUAL_PASS=1                        # classify twice, keep the conservative band, report agreement
```

Jobs code against one provider neutral interface (`server/llm/types.ts`). Claude is implemented for the first party API (direct or through an internal gateway), Amazon Bedrock and Google Vertex through one adapter (`server/llm/claude.ts`). `openai`, `google` and `azure-openai` are reserved provider names: routing to one before its adapter exists fails at startup with a clear message, so a job is never silently served by the wrong model. Each call emits one JSON usage line (job, provider, model, tokens, latency) for cost tracking. `GET /api/health` returns the routing table, the auth mode and which credential sources are present by name, never values.

## Credentials

The server never needs an Anthropic API key. `LLM_AUTH_MODE` selects how Claude calls authenticate:

| Mode | How it works | Variables |
| --- | --- | --- |
| `gateway` | No credential leaves the process. The base URL is an internal gateway that authenticates on the network path; the SDK's auth headers are omitted. | `ANTHROPIC_BASE_URL`, optional `LLM_GATEWAY_HEADERS` (JSON object) |
| `env` (default) | The SDK resolves credentials: API key, bearer token, workload identity federation or a CLI profile. | `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` or the federation variables |
| Bedrock route | Cloud identity through the AWS default credential chain. | `LLM_BEDROCK_REGION` or `AWS_REGION` |
| Vertex route | Google application default credentials. | `LLM_VERTEX_REGION`, `LLM_VERTEX_PROJECT_ID` |

## Layout

```
index.html        AI RolePlay entry (src/main.tsx)
assess/index.html Conversation AI entry (src/main-assess.tsx)
src/products.ts   the two product definitions (name, 4E line, mode, mark) and the theme hook
src/apps/         PracticeApp (AI RolePlay shell), AssessmentApp (Conversation AI shell)
src/domain/       pure scoring engine, scenario schema, report assembly, claim ladder (no clocks, no IO)
src/providers/    NPC, classifier and report writer interfaces; mock and http implementations
src/pages/        PracticeLanding, AssessmentLanding, SessionPage, SummaryPage (the last two take a product prop)
src/components/   shared UI
src/data/         the authored scenario and sample cohort data
src/store/        attempt persistence (localStorage until the backend exists)
server/           API server: config, LLM registry and runner, jobs, routes
prompts/          versioned prompt files, one folder per job
test/             vitest: engine, classifier heuristics, routing config, report assembly
docs/             handover, architecture, scoring method, product strategy
```

See `docs/handover.md` for the full file map, scoring rules and what is still mocked, `docs/architecture.md` for the request flow, and `docs/product-strategy.md` for the market analysis this product is built on.

## Claude Code mods

`tools/claude-mods/` holds three Claude Code hooks modules that guard git activity Claude runs through Bash. Install any of them from this repository's marketplace with `/plugin install <name> --marketplace maverick-nair/AIRolePlay2.0`:

| Mod | Guards |
| --- | --- |
| `copy-lint-guard` | Runs `pnpm lint:copy` before `git commit` or `git push`; blocks on an em or en dash or banned wording. |
| `secret-guard` | Refuses commands carrying a literal API key, staging `.env` files, and commits or pushes whose changes add a secret looking value. |
| `push-check` | Runs `pnpm check` before `git push` and blocks the push when typecheck, lint, tests or the build fail. |

Each has a README with details and tests runnable with `claude plugin test tools/claude-mods/<name>`.

## Copy and accessibility rules

Say "skills", never "competency". No em dashes, no en dashes, no emojis anywhere (the copy lint fails on them). WCAG 2.2 AA: keyboard operable, visible focus, reduced motion respected, secondary text at `text-ink/70` or stronger. Default exports for components.

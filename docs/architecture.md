# Architecture

## Request flow

```
Browser (Vite app)                         API server (server/)                    Provider
------------------                         --------------------                    --------
SessionPage
  player turn ──► providers.classifier ──► POST /api/classify ──► jobs/classify ──► LlmClient.parse  (route: LLM_ROUTE_CLASSIFY)
                  (Zod validated reply)        │                    │ retry once, then fallback route, then mock
  turnOutcome (pure) ◄─────────────────────────┘                    └─ usage line to stdout
  scheduleReply ──► providers.npc ───────► POST /api/npc ──────► jobs/npc ──────► LlmClient.complete (route: LLM_ROUTE_NPC)
End Call
  scoreSession (pure) ──► providers.reporter ► POST /api/report ──► jobs/report ──► LlmClient.parse  (route: LLM_ROUTE_REPORT)
  assembleReport (pure) ──► attempts store ──► SummaryPage
```

With `VITE_AI_PROVIDER=mock` (the default) the browser never calls the server: the same provider interfaces are implemented offline in `src/providers/mock.ts`. With `http`, the browser calls the server and validates every response with Zod; if the server is unreachable it falls back to the mock so a session is never lost, and the report records which provider produced each part.

## Layers

| Layer | Path | Rules |
| --- | --- | --- |
| Domain | `src/domain/` | Pure and deterministic. Scenario schema, scoring engine, report assembly, descriptive metrics, claim ladder. ESLint blocks clocks, randomness, network, storage and UI imports. |
| Providers (client) | `src/providers/` | Interfaces for NPC, classifier and report writer; Zod request and response schemas shared with the server; mock and http implementations. |
| Store | `src/store/` | Attempt persistence. localStorage today; the `Report` shape is what the backend will store. Enforces one assessment attempt. |
| Products | `index.html`, `assess/index.html`, `src/products.ts`, `src/apps/` | Two Vite entries. AI RolePlay (`/`, practice) and Conversation AI (`/assess/`, assessment) are separate shells over the same pages, providers and store. `src/products.ts` names each product, its 4E line and its mode; the shell sets `data-product` so the stylesheet applies the product accent. |
| UI | `src/pages/`, `src/components/` | React 19, Tailwind v4, tokens in `src/index.css`. Pages read the scenario object, the product and engine output only. `SessionPage` and `SummaryPage` are shared and take a `product` prop; each product has its own landing. |
| Server | `server/` | Node http. `config.ts` parses routing from env. `llm/` holds the provider contract, adapters, registry and runner. `jobs/` holds one file per AI job. `index.ts` wires routes. |
| Prompts | `prompts/<job>/<version>.md` | Front matter plus body with `{{placeholders}}`. Selected per job by `PROMPT_VERSION_<JOB>`. |

## LLM routing

`server/config.ts` reads one route per job (`provider:model[:effort]`), a default, an optional fallback per job, prompt versions, timeouts and retry counts. `server/llm/registry.ts` turns a route into a cached `LlmClient` and refuses unknown or unimplemented providers at startup. `server/llm/runner.ts` executes a job call against the primary route, then the fallback, logging a JSON usage line per call (job, provider, model, effort, tokens, cache tokens, latency, ok). When every route fails the job returns the offline implementation's answer and the response `meta.provider` says `mock`.

Credentials: `server/llm/claude.ts` builds the first party, Bedrock and Vertex clients. In `gateway` auth mode the SDK's auth headers are omitted and `ANTHROPIC_BASE_URL` must point at the internal gateway, so no credential is ever held by this process. In `env` mode the SDK resolves a key, a bearer token, workload identity or a profile on its own. Bedrock and Vertex use cloud identity. `credentialSources()` reports which variables are present by name for the health route; values are never read by application code.

Adding a provider: implement `LlmClient` in `server/llm/<provider>.ts` (two methods, `complete` and `parse`), add a case in `registry.ts`, and add the credential name to `.env.example`. No job changes.

Choosing routes: the persona job is latency sensitive and benefits from low effort; the classifier and report writer are accuracy sensitive and benefit from medium or higher effort and from dual pass classification. Security sensitive deployments can route all three to a private endpoint (Bedrock, Vertex, Azure) once those adapters exist, with no change to the browser.

## Scoring method (summary)

1. Classifier returns bands per indicator with a verbatim quote and a one sentence note. Bands only.
2. Points: Strong 10, Adequate 7, Weak 4, Harmful 1. Unobserved indicator 4. Repeated hits average.
3. Skill score = rounded mean of indicator points (1 to 10). Overall = weighted mean, rounded. Pass mark per scenario.
4. Objectives complete on an Adequate or better band on a listed indicator. XP, streak and badges follow fixed rules.
5. Narrative is bound to the evidence. Descriptive metrics never enter the score.

Full rules and tests: `src/domain/scoring.ts`, `test/scoring.test.ts`, `docs/handover.md`.

## Validation posture

The instrument ships at claim rung 1 (structured feedback). The report, landing page and PDF say so. Rungs 2 to 4 require calibration against trained assessors, parallel forms and fairness analysis, then convergent and criterion evidence. `src/domain/instrumentStatus.ts` holds the ladder; `src/data/scenarios/*.ts` hold each instrument's rung and evidence summary.

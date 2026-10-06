# CLAUDE.md

Guidance for anyone (human or agent) working in this repository: AI RolePlay 2.0, a practice and assessment product for workplace conversations.

## Read first

- `README.md`: the two products, quick start, LLM routing.
- `docs/handover.md`: file map, scoring rules, what is still mocked.
- `docs/architecture.md`: request flow, provider contract, where each kind of code lives.
- `docs/product-strategy.md`: the market analysis and the claim ladder this product is built around.

## Architecture rules

1. **Everything is data.** A scenario is one Zod validated object: `stimulus` (persona, hidden interests, opening, critical incidents) plus `instrument` (skills, behavioural indicators with anchors and coaching copy, objectives, claim rung). UI, providers, engine and report all read this one object (`src/domain/scenario.ts`).
2. **Pure domain.** `src/domain/` is deterministic TypeScript: no `Date`, no `Math.random`, no network, no storage, no React, no SDKs. ESLint enforces this.
3. **AI judges, rules decide.** Models classify turns into bands and write narrative. Points come only from the consequence tables in `src/domain/scoring.ts`. Never pass a model produced number into a score.
4. **Provider adapters.** Every AI job sits behind the interface in `server/llm/types.ts`, routed per job by environment (`LLM_ROUTE_<JOB>`). Jobs never import a vendor SDK. Credentials come from the environment only. Never commit a key or a default model id in code; `.env.example` holds names and commented examples.
5. **Structured outputs.** Every model call that returns data is validated with Zod and retried once; then the fallback route; then the offline implementation. Prompts are versioned files in `prompts/<job>/<version>.md`. No inline prompt strings.
6. **Report integrity.** A report shows only engine output, authored scenario copy and narrative bound to that evidence. Every rating is tied to quoted turns. The claim rung is shown wherever a score is shown. Do not raise `claimRung` in a scenario without the evidence listed in `src/domain/instrumentStatus.ts`.
7. **Two products, one instrument.** Conversation AI (Evaluate, `/assess/`) is assessment: one attempt, hidden criteria, fixed incidents, no hints, no rewind. AI RolePlay (Experience, `/`) is practice: unlimited, criteria on request, hints, rewind, adaptive persona. Each product is its own entry and shell (`src/products.ts`, `src/apps/`); never offer one product's mode inside the other, and never mix the two in one session type.
8. **Audio rules.** Score transcripts only. No voice or facial emotion inference anywhere. Consent before any capture. Audio analytics are descriptive, never scores.
9. **Accessibility.** WCAG 2.2 AA, keyboard operable, visible focus, reduced motion respected, secondary text at `text-ink/70` or stronger.

## Copy rules

Say "skills", never "competency". No em dashes, no en dashes, no emojis in code, docs, prompts or commit messages. Sentence case. `pnpm lint:copy` enforces the dash and wording rules.

## Workflow

- `pnpm check` before every push: typecheck, lint, copy lint, format check, tests, build.
- New engine logic needs a unit test in `test/`. Changes to scoring rules update `docs/handover.md` and need re-validation of the instrument.
- Components use default exports. Formatting is Prettier with the repo config.

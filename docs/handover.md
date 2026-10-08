# AI RolePlay 2.0 - Handover

## What it is

Two products on one instrument, one engine and one backend. They are separate interfaces with separate entry points, and neither offers the other's mode:

- **AI RolePlay** (Experience line, `/`, `index.html`, `src/apps/PracticeApp.tsx`): practice. Up to `maxPracticeAttempts` runs per scenario (five by default; the landing counts them down and Start turns into "All 5 runs used", the report drops Practise again on the last run), rewind to any of your turns (the persona rewinds with you), criteria available on request, in the moment hints, selectable persona difficulty, and a trend across runs. Scores are for the learner.
- **Conversation AI** (Evaluate line, `/assess/`, `assess/index.html`, `src/apps/AssessmentApp.tsx`): assessment. One attempt per scenario, a fixed time limit, a standardised persona that follows a schedule of critical incidents, hidden criteria, no hints, no rewind, and an explicit confirmation before the attempt begins. The lock lives in the attempt store; once an attempt exists the landing shows the saved report instead of a start button.

Product definitions (name, 4E line, mode, mark) live in `src/products.ts`. `applyProductTheme` sets `data-product` on the document root so `src/index.css` can give Conversation AI its blue accent while every token name stays the same. The attempt store is shared, so a completed assessment never blocks practice and practice runs never count as an assessment.

Scenario shipped: **Renewal Negotiation with Margaret Hale** (VP Procurement, Northwind Freight). No emojis, no em or en dashes. Dark and light themes, WCAG 2.2 AA.

Every score is produced the same way in both modes: an LLM (or the offline heuristic) classifies each participant turn into a band (Strong, Adequate, Weak, Harmful) against authored behavioural indicators with written anchors, quoting the words that justify the band. Rules turn bands into points through a fixed consequence table. No model ever emits a number into a score. Every rating in the report traces to quoted turns, and every report states where the instrument sits on the claim ladder (rung 1 of 4 today: structured feedback, not for talent decisions).

## Run

This repository is standalone (Node 22, pnpm 10).

```
pnpm install              # at the repo root
pnpm dev                  # Vite dev server with the offline providers (PORT env var, default 8443)
pnpm server               # local API server on ROLEPLAY_API_PORT (default 8787)
pnpm dev:ai               # Vite with VITE_AI_PROVIDER=http, proxies /api to the server
pnpm build                # production build
pnpm typecheck            # tsc --noEmit (src, server, test, scripts)
pnpm test                 # vitest: scoring engine, classifier heuristics, routing config, report assembly
pnpm check                # everything CI runs
```

Providers: `VITE_AI_PROVIDER=mock` (default) runs everything in the browser with scripted persona lines, a transparent pattern based classifier and a template report writer. `VITE_AI_PROVIDER=http` sends persona, classification and report calls to the API server. The server routes each job (`npc`, `classify`, `report`) independently through `LLM_ROUTE_<JOB>=provider:model[:effort]`, with `LLM_ROUTE_DEFAULT`, an optional `LLM_FALLBACK_<JOB>`, and `PROMPT_VERSION_<JOB>`. Claude is implemented for the first party API (directly or through an internal gateway with `LLM_AUTH_MODE=gateway`, no key in the process), Bedrock (IAM) and Vertex (ADC) through one adapter; routing to a reserved provider without an adapter fails at startup. Jobs routed to `mock` answer with the offline providers. `ROLEPLAY_DUAL_PASS=1` runs each classification twice and reports the agreement; on disagreement the more conservative band is kept. Every call logs one JSON usage line. See `.env.example` and `docs/architecture.md`.

Stack: React 19, TypeScript, Vite 8, Tailwind CSS v4, Zod 4, `@anthropic-ai/sdk`, jsPDF (lazy loaded), Vitest, ESLint, Prettier, Node http for the server (run with tsx).

## Files

- `index.html` and `assess/index.html` - the two entries; `vite.config.ts` builds both (`build.rollupOptions.input`).
- `src/main.tsx`, `src/main-assess.tsx` - mount `PracticeApp` and `AssessmentApp`.
- `src/products.ts` - the two product definitions and the theme hook.
- `src/apps/` - `PracticeApp` (theme, page switch, run options, attempt list for AI RolePlay), `AssessmentApp` (theme, page switch, the one completed attempt for Conversation AI).
- `src/pages/` - `PracticeLanding` (briefing, skills with indicators on request, objectives, feedback status, run setup with difficulty and hints), `AssessmentLanding` (briefing, skills without indicators, assessment rules, confirmation and begin, completed state), `SessionPage` (turn loop, snapshots and rewind, hints that stay until the next reply, incident scheduling via the provider; End Call asks first in both products, Keep talking holds focus and Escape returns to End Call, then the report is built; the XP HUD, leaderboard, live feedback, objective progress and confetti are practice only), `SummaryPage` (Overview, Evidence by Skill, Communication and Transcript tabs; the claim rung box sits above every tab and the PDF carries the same sections; Rewards and confetti are practice only).
- `src/domain/` - pure, deterministic:
  - `scenario.ts` Zod schemas. A scenario is `stimulus` (persona, hidden interests, opening, critical incidents, mock lines) plus `instrument` (skills, indicators with anchors and coaching copy, objectives, claim rung, evidence summary, peer baseline). `validateScenario` checks cross references.
  - `scoring.ts` consequence tables (`BAND_POINTS`, `NOT_OBSERVED_POINTS`), indicator and skill scoring, overall score and coverage, objective completion, per turn XP, streak and badge rules, level thresholds, practice hints.
  - `report.ts` report assembly from engine output plus narrative, transcript tagging from evidence, report ids.
  - `descriptive.ts` transcript derived conversation metrics (talk share, questions, offers, filler). Descriptive only, never scored.
  - `instrumentStatus.ts` the four rung claim ladder and what each rung requires.
- `src/providers/` - `types.ts` (interfaces and Zod request and response schemas shared with the server), `mock.ts` (offline persona, heuristic classifier, template writer), `http.ts` (calls `/api/*`, validates responses, falls back to mock), `index.ts` (selection).
- `src/store/attempts.ts` - localStorage attempt store standing in for the sessions backend; enforces the one assessment attempt.
- `src/data/scenarios/renewalNegotiation.ts` - the authored scenario. `src/data/` also keeps `badges.ts`, `peers.ts`, `bands.ts` and the sample cohort numbers.
- `src/components/` - `TenPointScale`, `SkillScore`, `SkillRadar`, `ScoreRing`, `BandChip`, `ClaimLadderPanel`, `AttemptTrend`, `VoiceWave`, `BoxField`, `ConfettiBurst`, `BadgeMedal`, `FlameIcon`, `RollingNumber`, `EmailDialog`, `ThemeToggle`, `ToolButton`, `CountdownTimer`, `SectionLabel`, `LeaderboardIcon`.
- `src/lib/` - `reportId.ts`, `score.ts` (`bandFor`, `scoreColor`, `scoreLabel`, `cefrColor`), `color.ts` (`readableOn`), `motion.ts`, `useCountUp.ts`, `buildReportPdf.ts` (renders the report object), `theme.ts`.
- `server/` - `index.ts` (routes `/api/npc`, `/api/classify`, `/api/report`, `/api/health`), `config.ts` (per job routing from env), `llm/` (provider contract, Claude adapter with first party, gateway, Bedrock and Vertex factories, registry, runner with fallback and usage logging), `jobs/` (one file per AI job), `prompts.ts` (loads `prompts/<job>/<version>.md`). Structured outputs are validated with Zod, retried once, then the fallback route, then the offline provider.
- `test/scoring.test.ts` - engine, classifier, hints, descriptive metrics, report assembly, claim ladder.
- `test/config.test.ts` - routing config parsing, defaults, credential hygiene, dual pass reconciliation.
- `test/registry.test.ts` - provider construction without keys (gateway, Bedrock, Vertex), startup refusals, auth config.
- `scripts/lint-copy.ts` - copy lint (dashes, wording).

## Theme tokens (index.css)

- `:root` = dark, `:root.light` = light.
- `--ink` is RGB channels: use `rgb(var(--ink) / a)`. `--bg` is hex: use `color-mix(in srgb, var(--bg) X%, transparent)`, never `rgb(var(--bg)/a)`.
- Dark: bg `#0e0d0c`, brand `#ff8a4c`, accent `#c2410c`. Light: bg `#f4f2ef`, brand `#b8320f`.
- Secondary text must be `text-ink/70` or stronger (lower fails AA in light theme).

## Knolskape 10-point bands

Novice 1-2 `#b5472f`, Emerging 3-4 `#e07b2e`, Competent 5-6 `#efc23a`, Proficient 7-8 `#8dc063`, Role Model 9-10 `#2f7a34`. Use `bandFor(score)` and `readableOn(hex)`. Only the band containing the score is elevated. Behavioural bands (Strong, Adequate, Weak, Harmful) use `BAND_COLORS` in `BandChip`.

## Scoring rules (engine, do not change without re-validating)

- Band points: Strong 10, Adequate 7, Weak 4, Harmful 1. An indicator never observed counts 4, because every indicator in this scenario has an opportunity to appear.
- Repeated hits on one indicator average their points.
- Skill score = rounded mean of indicator points, clamped to 1 to 10. Overall = weighted mean of skill scores, rounded. Pass mark is per scenario (8 here).
- Objective complete = an Adequate or better band on one of its listed indicators. XP: 25 for on topic, 45 per newly met objective, a length bonus capped at 20, times 1.5 from the third strong reply in a row. Off topic turns earn nothing and reset the streak.
- Conversation metrics and language analysis are descriptive and never enter the score. Audio is scored by transcript only; no voice or facial emotion inference anywhere.

## What is still mocked (needed before production)

1. **Persona, classifier and report writer** run offline by default. With routes configured the API server uses Claude through your environment's own credentials (gateway, bearer token, Bedrock or Vertex identity). The LLM path has not yet been exercised against a live key in this repository; validate the prompts and output schemas on real traffic first. Adapters for other providers are routing names only until written.
2. **Speech**: dictation types a fixed phrase, the camera is a stock image, there is no text to speech. Real STT and TTS belong behind adapters on the server, with consent before capture.
3. **Sessions, peers and leaderboard**: attempts persist in localStorage, peer baselines and the leaderboard are sample constants. The report shape in `src/domain/report.ts` is what the backend should store.
4. **Email** is a mailto handoff; real sending with the PDF attached needs a server.
5. **Validation**: the instrument is on claim rung 1. Rung 2 needs a calibration set rated by trained assessors with agreement per skill; rung 3 needs parallel forms and subgroup fairness analysis; rung 4 needs convergent and criterion evidence and a technical manual. Do not change the rung in the scenario file without that evidence.

## Code rules

Default exports for components; double quotes for strings with apostrophes; global CSS and fonts in `index.css`; respect `prefers-reduced-motion`. Formatting is Prettier with the repo root config. Say "skills", never "competency". No em or en dashes anywhere (the root copy lint fails on them). Prompts live only in `/prompts`, never inline.

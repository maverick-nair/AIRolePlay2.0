# AI RolePlay 2.0 - Handover

## What it is

Two products on one instrument, one engine and one backend. They are separate interfaces with separate entry points, and neither offers the other's mode:

- **AI RolePlay** (Experience line, `/`, `index.html`, `src/apps/PracticeApp.tsx`): practice. Up to five runs per scenario (`maxPracticeAttempts` in the scenario), rewind to any of your turns (the persona rewinds with you), criteria available on request, in the moment hints, selectable persona difficulty, and a trend across runs. Scores are for the learner.
- **Conversation AI** (Evaluate line, `/assess/`, `assess/index.html`, `src/apps/AssessmentApp.tsx`): assessment. One attempt per scenario, a fixed time limit, a standardised persona that follows a schedule of critical incidents, hidden criteria, no hints, no rewind, and an explicit confirmation before the attempt begins. The lock lives in the attempt store; once an attempt exists the landing shows the saved report instead of a start button.

Product definitions (name, 4E line, mode, mark) live in `src/products.ts`. `applyProductTheme` sets `data-product` on the document root so `src/index.css` can give each product its own design language while every token name stays the same. The attempt store is shared, so a completed assessment never blocks practice and practice runs never count as an assessment.

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
- `src/pages/` - all four pages sit inside `AppShell` (rail plus content). The three player screens are single frame cockpits: on a laptop or tablet everything the player needs is on screen at once, with no page scroll, tabs, accordions, drawers or sheets. `PracticeLanding` (header strip with the title, terms and the game layer: day streak, total XP, level, daily goal and week strip; a situation column with the persona, the challenge, scene, role and goal; a column with the objectives and the weighted skills; a run column with difficulty tiles, hints, Start, Your path of five runs, weekly quests and badges, all derived from saved runs only), `AssessmentLanding` (header strip with the terms and a pilot, feedback only chip while the instrument is on rung 1; the brief as a numbered paper with scene, role, goal and challenge with objectives; the counterpart and skills mapped; the microphone and camera access test in `DeviceCheck`, then the instructions, the extended time note, the confirmation and Begin; completed state), `SessionPage` (header strip with the title, in practice the objectives bar, level, XP, strong streak and badges, then the timer and End Call; a brief column with your goal, the challenge and the objectives with their status, and in practice the behaviours each objective needs when What counts is on; the stage with the 1:1 portrait, a ring for who holds the floor, a thinking, speaking, listening or your turn state, live caption, the feedback sheet with its reason, and a control bar with hold to talk (Space) and text always open, interruption in both products, practice tools on H, W and R; the transcript with the feedback on each of your replies under it; turn loop, snapshots and rewind, incident scheduling via the provider, report build on End Call), `SummaryPage` (header card with report facts, Share menu and in practice the peer view switch; the claim rung box; Overview, Evidence by Skill, Communication and Transcript tabs; the PDF carries the same sections). The Overview leads with the result: in Conversation AI a pass mark sentence, What happens next and a pilot label while the instrument is on rung 1; in AI RolePlay a run complete moment and Your next move (one behaviour, the words that showed it, the authored recommendation and Practise again). Then three key moments, one skills chart (sample cohort ticks in practice only), overall feedback, and in practice the runs and rewards panel with an opt in comparison ranked by improvement. Conversation AI shows no peer toggle, cohort, drills or rewards.
- `src/domain/` - pure, deterministic:
  - `scenario.ts` Zod schemas. A scenario is `stimulus` (persona, hidden interests, opening, critical incidents, mock lines) plus `instrument` (skills, indicators with anchors and coaching copy, objectives, claim rung, evidence summary, peer baseline). `validateScenario` checks cross references.
  - `scoring.ts` consequence tables (`BAND_POINTS`, `NOT_OBSERVED_POINTS`), indicator and skill scoring, overall score and coverage, objective completion, per turn XP, streak and badge rules, level thresholds, practice hints.
  - `report.ts` report assembly from engine output plus narrative; `opportunityFor` finds the persona line where the critical incident linked to an indicator landed (through each incident's `opportunityFor` list in the scenario), so a report names the moment a missed behaviour had instead of a generic line; and transcript marks: every marked turn lists each indicator it touched with its band (gaps first), never a bare Strength label. Adequate hits are not marked.
  - `descriptive.ts` transcript derived conversation metrics (talk share, questions, offers, filler). Descriptive only, never scored.
  - `instrumentStatus.ts` the four rung claim ladder and what each rung requires.
- `src/providers/` - `types.ts` (interfaces and Zod request and response schemas shared with the server), `mock.ts` (offline persona, heuristic classifier, template writer), `http.ts` (calls `/api/*`, validates responses, falls back to mock), `index.ts` (selection).
- `src/store/attempts.ts` - localStorage attempt store standing in for the sessions backend; enforces the one assessment attempt.
- `src/data/scenarios/renewalNegotiation.ts` - the authored scenario. `src/data/` also keeps `badges.ts`, `peers.ts`, `bands.ts` and the sample cohort numbers.
- `src/components/` - `TenPointScale`, `SkillScore`, `ScoreRing`, `BandChip`, `ClaimLadderPanel`, `AttemptTrend`, `VoiceWave`, `ConfettiBurst`, `BadgeMedal`, `FlameIcon`, `RollingNumber`, `EmailDialog`, `ThemeToggle`, `CountdownTimer`, `SectionLabel`, `MarkList`, `DeviceCheck`, `AppShell` (rail, frame and build id), `Tabs` (WAI-ARIA tabs with arrow, Home and End keys, plus `tabPanelProps`), `Icon` (line icons and filled flame and star glyphs).
- `src/lib/` - `reportId.ts`, `score.ts` (`bandFor`, `scoreColor`, `scoreLabel`, `cefrColor`), `color.ts` (`readableOn`), `motion.ts`, `useCountUp.ts`, `buildReportPdf.ts` (renders the report object), `theme.ts`, `progress.ts` (day streak, XP today against the daily goal, the week strip and weekly quests, derived from saved runs; uses the clock, so it lives in lib, not domain).
- `server/` - `index.ts` (routes `/api/npc`, `/api/classify`, `/api/report`, `/api/health`), `config.ts` (per job routing from env), `llm/` (provider contract, Claude adapter with first party, gateway, Bedrock and Vertex factories, registry, runner with fallback and usage logging), `jobs/` (one file per AI job), `prompts.ts` (loads `prompts/<job>/<version>.md`). Structured outputs are validated with Zod, retried once, then the fallback route, then the offline provider.
- `test/scoring.test.ts` - engine, classifier, hints, descriptive metrics, report assembly, claim ladder.
- `test/config.test.ts` - routing config parsing, defaults, credential hygiene, dual pass reconciliation.
- `test/registry.test.ts` - provider construction without keys (gateway, Bedrock, Vertex), startup refusals, auth config.
- `scripts/lint-copy.ts` - copy lint (dashes, wording).

## Theme tokens and design languages (index.css)

Both products share one frame taken from a lecture page reference: a slim icon rail (`AppShell`; down the left edge from md, a top bar on phones, with the build id at its foot), a soft grey ground (`--bg`) and white cards (`.card`, `--surface`, a 1px decorative `--edge`). From md up every player screen is one fixed frame, a cockpit: a header strip, then two or three columns of compact cards sized so the whole screen fits with no scroll. The layouts are checked at 1513 by 745, 1440 by 800, 1366 by 700 and 1280 by 720 on a laptop, and 1180 by 820 and 820 by 1180 on a tablet; below the sizes they were built for, the content area scrolls as a fallback rather than clipping anything, and phones scroll as normal. The cockpit type scale (`.t-body`, `.t-small`) steps down a little on narrower or shorter frames and never goes below 12px. The only scrolling region on a player screen is the live transcript, which keeps the newest lines in view. Both open light; dark is a toggle at the foot of the rail. Inside the frame they never look alike:

- **AI RolePlay** is a practice studio for a mature audience, entry level to leadership, with ideas from Duolingo and Brilliant kept adult: a warm orange accent (`--accent` `#c2410c` light, `--accent-ui` `#ea580c` for tracks and icons), Figtree, 16px cards and 12px controls. The game layer is a path of five runs, level and XP, a day streak, a daily goal of 100 XP with a week strip, three weekly quests and badges, all derived from saved runs. After each reply a feedback sheet says Strong reply, Good reply or Not quite, with Why? and Try again; a hint that fires at the same moment joins that sheet.
- **Conversation AI** is a quiet assessment room: an indigo accent (`--accent` `#3730a3` light, `--brand` `#4338ca`), IBM Plex Sans with IBM Plex Mono for numbers, indexes and the timer, 10px cards and 8px controls, a numbered brief and a three step flow. No game layer.
- Token roles: `--brand` is accent text, `--accent` a fill behind white text, `--accent-ui` progress, focus rings and icons (at least 3:1), `--accent-soft` and `--accent-soft-ink` chips and selected states, `--line` control borders (at least 3:1, WCAG 1.4.11), `--edge` decorative borders only. Every text pair is at least 4.5:1 and every UI pair at least 3:1 in both themes of both products.
- Shared classes: `.btn` (44px), `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.card`, `.chip`, `.chip-neutral`, `.choice`, `.seg` (report tabs), `.rail-item`, `.sheet-ok`, `.sheet-warn`, `.kbd`, `.t-body`, `.t-small`. Each product's look comes from `data-product` on the root, so the same markup reads differently in each.
- `--ink` is RGB channels: use `rgb(var(--ink) / a)`. `--bg` is hex: use `color-mix(in srgb, var(--bg) X%, transparent)`, never `rgb(var(--bg)/a)`. `--ok`/`--ok-tint` and `--warn`/`--warn-tint` are text and tint pairs checked for AA in both themes.
- Fonts are self hosted from `@fontsource` packages, never a third party font host. Portrait placeholders are always 1:1.
- Secondary text must be `text-ink/70` or stronger, and no text is below 12px. Any control with an `aria-label` must contain its visible text (WCAG 2.5.3); use visible text plus `sr-only` text instead.

## Knolskape 10-point bands

Novice 1-2 `#b5472f`, Emerging 3-4 `#e07b2e`, Competent 5-6 `#efc23a`, Proficient 7-8 `#8dc063`, Role Model 9-10 `#2f7a34`. Use `bandFor(score)` and `readableOn(hex)`. Only the band containing the score is elevated. Behavioural bands (Strong, Adequate, Weak, Harmful) use `BAND_COLORS` in `BandChip`.

## Scoring rules (engine, do not change without re-validating)

- Band points: Strong 10, Adequate 7, Weak 4, Harmful 1. An indicator never observed counts 4, because every indicator in this scenario has an opportunity to appear.
- Repeated hits on one indicator average their points.
- Skill score = rounded mean of indicator points, clamped to 1 to 10. Overall = weighted mean of skill scores, rounded. Pass mark is per scenario (8 here).
- Objective complete = an Adequate or better band on one of its listed indicators. XP rewards behaviours, never length: 15 for an on topic turn, plus 15 per Strong and 8 per Adequate behaviour (best two counted), plus 45 per newly met objective. Weak and Harmful bands earn nothing. The streak counts consecutive turns with a Strong behaviour, resets on a Weak or Harmful band, and multiplies XP by 1.5 from the third. Off topic turns earn nothing and reset the streak. Career XP and level come only from saved practice runs (`careerXp` in the attempt store); a first time learner starts at zero as a Newcomer.
- Conversation metrics and language analysis are descriptive and never enter the score. Audio is scored by transcript only; no voice or facial emotion inference anywhere.

## Participant safeguards (do not remove)

- **Live caption.** The latest persona line is always shown under the persona on every viewport, as a polite live region. The transcript log is keyboard reachable and does not announce, so lines are read once.
- **Ending a call.** Conversation AI asks for confirmation before ending the single attempt (focus starts on Keep talking, Escape cancels). AI RolePlay gives a five second Resume window before scoring. Timer expiry ends an assessment without asking.
- **Phone brief.** On small screens the Conversation AI brief collapses (scene and instructions open) and a sticky Review and begin bar leads to the confirmation.
- **Landmarks.** Every screen has a main landmark; the call screen has an h1 and labelled side panels.
- **Time warnings.** The timer announces five minutes and one minute left and changes shape as well as colour.
- **Interruptions** are counted and shown in the Communication tab as descriptive data. They never enter a score.

## What is still mocked (needed before production)

1. **Persona, classifier and report writer** run offline by default. With routes configured the API server uses Claude through your environment's own credentials (gateway, bearer token, Bedrock or Vertex identity). The LLM path has not yet been exercised against a live key in this repository; validate the prompts and output schemas on real traffic first. Adapters for other providers are routing names only until written.
2. **Speech**: dictation types a fixed phrase, the camera is a stock image, there is no text to speech. Real STT and TTS belong behind adapters on the server, with consent before capture.
3. **Sessions, peers and leaderboard**: attempts persist in localStorage under `gk.roleplay.attempts.v2` (`src/store/attempts.ts`; bump the key and retire the old one to reset access for every browser, which unlocks the assessment and restores all practice runs), peer baselines and the opt in cohort comparison (`src/data/peers.ts`) are sample constants and are labelled as a sample wherever they appear. The report shape in `src/domain/report.ts` is what the backend should store.
4. **Email** is a mailto handoff; real sending with the PDF attached needs a server.
5. **Validation**: the instrument is on claim rung 1. Rung 2 needs a calibration set rated by trained assessors with agreement per skill; rung 3 needs parallel forms and subgroup fairness analysis; rung 4 needs convergent and criterion evidence and a technical manual. Do not change the rung in the scenario file without that evidence.

## Code rules

Default exports for components; double quotes for strings with apostrophes; global CSS and fonts in `index.css`; respect `prefers-reduced-motion`. Formatting is Prettier with the repo root config. Say "skills", never "competency". No em or en dashes anywhere (the root copy lint fails on them). Prompts live only in `/prompts`, never inline.

# Eval scorecard

Recorded with `pnpm eval` on 8 October 2026 against the shared design (rubric in `docs/eval.md`).

| Run | Score | Failing checks |
| --- | --- | --- |
| Baseline, this design before fixes | 51.5 | 21 of 45 |
| Final | 100 | 0 of 45 |

The baseline run also carried some faults in the eval itself (phone journeys timed out, repeated button labels read as a focus trap, scrolled text read as overlapping, selected tabs counted as primary actions). Those were fixed in the eval, not the product, before the product fixes below were measured.

## What changed in the product

- Practice is capped at five runs again: the landing counts runs down, Start becomes "All 5 runs used", and the last report drops Practise again.
- Conversation AI has no game layer: the XP bar, streak, badges, leaderboard, live XP feedback, objective progress, rewards and confetti are practice only.
- End Call asks first in both products, because ending uses a practice run or the one assessment attempt. Keep talking takes focus; Escape returns to End Call.
- Hints stay until the next reply. Before, a hint vanished after 7 seconds, while the persona still held the floor.
- The offline classifier treats "we can match their price" as giving up the value anchor, so it brings a hint, and no longer credits a bare "we can" as collaborative (with unit tests).
- The Conversation AI brief now states the challenge and the objectives.
- Fonts are self hosted (Outfit and Inter), so pages no longer depend on Google Fonts; unused Figma font declarations are removed.
- Accessibility: one `main` landmark and one `h1` per screen, a focusable transcript region, accessible names that contain the visible label, no text below 12px, contrast fixes on the camera tile, score scale and objectives badge.
- Layout: no truncated skill names or clamped descriptions, paragraphs capped near 90 characters a line, retry links keep their space so the transcript no longer jumps, and the call and report work at 320px.

## Baseline by dimension

| Dimension | Weight | Checks passed | Score |
| --- | --- | --- | --- |
| Everything the player needs is there | 15 | 1 of 5 | 3.0 |
| Accessibility (WCAG 2.2 AA) | 25 | 3 of 9 | 8.3 |
| Task flow and efficiency | 15 | 6 of 6 | 15.0 |
| Product rules and integrity | 20 | 7 of 12 | 11.7 |
| Visual quality and layout | 15 | 4 of 8 | 7.5 |
| Robustness and performance | 10 | 3 of 5 | 6.0 |


## Final run

Score: **100 / 100**. 45 checks, 0 failing. Run took 225 s.

| Dimension | Weight | Checks passed | Score |
| --- | --- | --- | --- |
| Everything the player needs is there | 15 | 5 of 5 | 15.0 |
| Accessibility (WCAG 2.2 AA) | 25 | 9 of 9 | 25.0 |
| Task flow and efficiency | 15 | 6 of 6 | 15.0 |
| Product rules and integrity | 20 | 12 of 12 | 20.0 |
| Visual quality and layout | 15 | 8 of 8 | 15.0 |
| Robustness and performance | 10 | 5 of 5 | 10.0 |

## Checks

- pass: `info.home` AI RolePlay home shows the persona, brief, objectives, skills, run setup and progress
- pass: `info.brief` Conversation AI brief shows the role, goal, situation, challenge, skills, rules and begin
- pass: `info.call` Calls show the scenario, objectives, controls and transcript
- pass: `info.timer` The call timer is visible
- pass: `info.report` Reports show the score, pass mark, rung, every skill and every behaviour
- pass: `a11y.axe` axe: no WCAG 2.0, 2.1 or 2.2 A or AA violations
- pass: `a11y.axe-best-practice` axe: no best practice violations
- pass: `a11y.focus-visible` Every keyboard stop shows a visible focus indicator in view
- pass: `a11y.no-trap` Keyboard focus is never trapped
- pass: `a11y.text-size` No visible text below 12px
- pass: `a11y.target-size` Targets at least 24 by 24 px or spaced (2.5.8)
- pass: `a11y.reduced-motion` No endless motion when reduced motion is requested
- pass: `a11y.reflow` Reflow at 320 px: no sideways scroll (1.4.10)
- pass: `a11y.structure` One h1 and one main landmark per screen
- pass: `flow.start-one-click` A practice run starts in one click from the first screen of the home page
- pass: `flow.begin-gated` The assessment starts only after confirmation
- pass: `flow.reply-ack` A reply is acknowledged within 400 ms
- pass: `flow.feedback-fast` Practice feedback appears within 8 s of a reply
- pass: `flow.ready-fast` The first action is ready within 1.5 s of loading
- pass: `flow.no-dead-ends` Every screen has a way forward and a way back
- pass: `rules.ca-no-game` Conversation AI shows no game layer
- pass: `rules.ca-no-practice-tools` Conversation AI offers no hints, criteria or rewind
- pass: `rules.end-confirm` Ending a call asks first, Escape keeps the call and returns focus
- pass: `rules.ca-single-attempt` The assessment cannot be retaken
- pass: `rules.rp-run-cap` Practice stops after five runs
- pass: `rules.rung-with-score` The claim rung is shown wherever a score is shown
- pass: `rules.ratings-quoted` Every observed rating shows the words it came from
- pass: `rules.feedback-each-reply` Practice gives feedback on every reply
- pass: `rules.criteria-on-request` Practice criteria appear on request
- pass: `rules.hints` With hints on, a missed opportunity brings a hint
- pass: `rules.rewind` Retry from here rewinds the reply
- pass: `rules.copy` No em or en dashes, and skills is the word used
- pass: `visual.no-sideways-scroll` No sideways scroll at any size
- pass: `visual.no-clipped` No region clips or hides content in a hidden overflow
- pass: `visual.no-overlap` No overlapping text
- pass: `visual.no-truncation` No text cut off by ellipsis or clamp
- pass: `visual.fonts` Only the product fonts are in use
- pass: `visual.line-length` Lines of text stay under 100 characters
- pass: `visual.one-primary` At most one primary action in view on home, brief and report screens
- pass: `visual.no-layout-shift` Cumulative layout shift below 0.05
- pass: `robust.no-errors` No console errors, warnings or page errors
- pass: `robust.no-failed-requests` No failed requests
- pass: `robust.bundle` Initial JavaScript under 200 KB gzip per product
- pass: `robust.lcp` Largest contentful paint under 1.5 s
- pass: `robust.long-tasks` No main thread task over 200 ms

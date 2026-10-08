# Eval scorecard

Recorded with `pnpm eval` on 8 October 2026 (rubric in `docs/eval.md`). The same result came back on two consecutive runs.

| Run | Score | Failing checks |
| --- | --- | --- |
| Baseline, before this pass | 51.3 | 18 of 47 |
| Final | 100 | 0 of 48 |

## Baseline by dimension

| Dimension | Weight | Checks passed | Score |
| --- | --- | --- | --- |
| One frame per player screen | 20 | 0 of 4 | 0.0 |
| Everything the player needs is on screen | 15 | 2 of 5 | 6.0 |
| Accessibility (WCAG 2.2 AA) | 20 | 5 of 9 | 11.1 |
| Task flow and efficiency | 10 | 5 of 6 | 8.3 |
| Product rules and integrity | 15 | 10 of 12 | 12.5 |
| Visual quality and consistency | 10 | 2 of 6 | 3.3 |
| Robustness and performance | 10 | 5 of 5 | 10.0 |


## Final run

Score: **100 / 100**. 48 checks, 0 failing. Run took 145 s.

| Dimension | Weight | Checks passed | Score |
| --- | --- | --- | --- |
| One frame per player screen | 20 | 5 of 5 | 20.0 |
| Everything the player needs is on screen | 15 | 5 of 5 | 15.0 |
| Accessibility (WCAG 2.2 AA) | 20 | 9 of 9 | 20.0 |
| Task flow and efficiency | 10 | 6 of 6 | 10.0 |
| Product rules and integrity | 15 | 12 of 12 | 15.0 |
| Visual quality and consistency | 10 | 6 of 6 | 10.0 |
| Robustness and performance | 10 | 5 of 5 | 10.0 |

## Checks

- pass: `frame.no-scroll` No page or frame scroll on laptop and tablet
- pass: `frame.no-clipped-panels` No panel overflows or clips its content
- pass: `frame.no-disclosure` No tabs, accordions, collapsed sections or carousels
- pass: `frame.report-summary` Reports show the result, rung, next step and every skill score in the first frame
- pass: `frame.report-one-frame` Reports fit one frame at 1513x745 and 1440x800
- pass: `info.home` AI RolePlay home shows the full brief, scoring, run setup and progress
- pass: `info.brief` Conversation AI brief shows the brief, skills, instructions, devices and begin
- pass: `info.call` Calls show the goal, challenge, objectives, controls and transcript
- pass: `info.timer` The call timer is visible
- pass: `info.report` Reports show every skill and every behaviour, with nothing hidden
- pass: `a11y.axe` axe: no WCAG 2.0, 2.1 or 2.2 A or AA violations
- pass: `a11y.axe-best-practice` axe: no best practice violations
- pass: `a11y.focus-visible` Every keyboard stop shows a visible focus indicator in view
- pass: `a11y.no-trap` Keyboard focus is never trapped
- pass: `a11y.text-size` No visible text below 12px
- pass: `a11y.target-size` Targets at least 24 by 24 px or spaced (2.5.8)
- pass: `a11y.reduced-motion` No endless motion when reduced motion is requested
- pass: `a11y.reflow` Reflow at 320 px: no sideways scroll (1.4.10)
- pass: `a11y.structure` One h1 and one main landmark per screen
- pass: `flow.start-one-click` A practice run starts in one click from the home screen
- pass: `flow.begin-gated` The assessment starts only after confirmation, in two actions
- pass: `flow.reply-ack` A reply is acknowledged within 400 ms
- pass: `flow.feedback-fast` Practice feedback appears within 8 s of a reply
- pass: `flow.ready-fast` The first action is ready within 1.5 s of loading
- pass: `flow.no-dead-ends` Every screen has a way forward and a way back
- pass: `rules.ca-no-game` Conversation AI shows no game layer
- pass: `rules.ca-no-practice-tools` Conversation AI offers no hints, criteria or rewind
- pass: `rules.ca-confirm` Ending the assessment asks first and returns focus
- pass: `rules.ca-single-attempt` The assessment cannot be retaken
- pass: `rules.rp-run-cap` Practice stops after five runs
- pass: `rules.rung-with-score` The claim rung is shown wherever a score is shown
- pass: `rules.ratings-quoted` Every observed rating shows the words it came from
- pass: `rules.feedback-each-reply` Practice gives feedback on every reply
- pass: `rules.criteria-on-request` Practice criteria appear on request
- pass: `rules.hint-on-request` Practice hints appear on request
- pass: `rules.rewind` Try again rewinds the last reply
- pass: `rules.copy` No em or en dashes, and skills is the word used
- pass: `visual.no-overlap` No overlapping text
- pass: `visual.no-truncation` No text cut off by ellipsis or clamp
- pass: `visual.consistency` One card radius, one control radius, product fonts only
- pass: `visual.line-length` Lines of text stay under 100 characters
- pass: `visual.one-primary` At most one primary action on home, brief and report screens
- pass: `visual.no-layout-shift` Cumulative layout shift below 0.05
- pass: `robust.no-errors` No console errors, warnings or page errors
- pass: `robust.no-failed-requests` No failed requests
- pass: `robust.bundle` Initial JavaScript under 200 KB gzip per product
- pass: `robust.lcp` Largest contentful paint under 1.5 s
- pass: `robust.long-tasks` No main thread task over 200 ms

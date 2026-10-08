# Product eval

`pnpm eval` scores AI RolePlay and Conversation AI against one rubric. It builds the app, serves it, drives the real player journeys in Chromium at laptop, tablet and phone sizes in both themes, measures every screen and writes a scorecard to `eval/results/latest.md` (and `latest.json`). It exits with code 1 when the score is below 100, so it can gate a release.

The eval checks what a player meets, not how the code is written. Unit tests cover the scoring engine; the eval covers the experience built on top of it. It measures this design as it is (tabbed report, side panels on the call, scrolling pages) and does not ask for a different layout.

## How to run

```
pnpm eval                             # full run, about 4 minutes
EVAL_PARALLEL=5 pnpm eval             # more journeys at once
EVAL_ONLY="laptop 1280" pnpm eval     # only the sizes whose name contains the text
EVAL_SHOTS=1 pnpm eval                # also save a full page screenshot of every state to eval/results/shots/
EVAL_BASE_URL=http://host pnpm eval   # measure a running build instead of building one
EVAL_CHROMIUM=/path/to/chromium pnpm eval
```

A run with `EVAL_ONLY` skips the five run cap journey, so its score is partial by design.

## What it drives

- **Practice journey (AI RolePlay):** home, Start practising, a weak reply ("We can match their price."), the hint it brings, Retry from here, two strong replies, Show what counts, End Call with its confirmation and Escape, End and score, all four report tabs with every skill opened, back home.
- **Assessment journey (Conversation AI):** the brief, Begin gated by the confirmation, the call, two replies, End Call with its confirmation, the report tabs, back to the brief, the completed state, and a reload to prove the single attempt holds.
- **Run cap journey:** five quick practice runs; the last report must not offer Practise again and the home page must show "All 5 runs used" with no way to start a sixth.

## Sizes

| Size | Themes |
| --- | --- |
| Laptop 1513x745 | dark, light |
| Laptop 1440x800 | dark |
| Laptop 1280x720 | dark |
| Laptop 1513x745, reduced motion | dark |
| Tablet 1180x820 | dark, light |
| Tablet 820x1180 | dark |
| Phone 390x844 | dark, light |
| Reflow 320x640 | dark |

Keyboard walks run at one laptop, one tablet, the portrait tablet and one phone size.

## Scoring

Six dimensions with fixed weights add up to 100. A check passes only when every instance of it passes on every screen and size where it applies. A dimension scores its weight times the share of its checks that pass.

| Dimension | Weight | Checks |
| --- | --- | --- |
| Everything the player needs is there | 15 | 5 |
| Accessibility (WCAG 2.2 AA) | 25 | 9 |
| Task flow and efficiency | 15 | 6 |
| Product rules and integrity | 20 | 12 |
| Visual quality and layout | 15 | 8 |
| Robustness and performance | 10 | 5 |

## Checks

### Everything the player needs is there

- `info.home`: the persona, scene, role, goal, challenge, every objective and skill, the difficulty options, hints, Start practising, practice runs, badges and the feedback status are on the page and visible.
- `info.brief`: the title, counterpart, role, goal, situation, challenge, every skill, the assessment rules, the confirmation and Begin.
- `info.call`: the scenario title, End Call, and from 1024px wide the objectives and transcript panels. Below that width the panels open from the top bar, so they are not required.
- `info.timer`: the call timer is visible.
- `info.report`: every skill and every behaviour, opened one skill at a time on the Evidence by Skill tab.

### Accessibility

- `a11y.axe`: no axe violations for WCAG 2.0, 2.1 and 2.2 A and AA.
- `a11y.axe-best-practice`: no axe best practice violations.
- `a11y.focus-visible`: a keyboard walk through each screen finds a visible focus ring, in view, at every stop.
- `a11y.no-trap`: focus always moves on (stops are told apart by element, not by label).
- `a11y.text-size`: no visible text below 12px; SVG text is measured at the size it is drawn.
- `a11y.target-size`: targets are at least 24 by 24 px or spaced (WCAG 2.5.8).
- `a11y.reduced-motion`: with reduced motion requested, nothing animates endlessly.
- `a11y.reflow`: at 320px wide nothing scrolls sideways (WCAG 1.4.10).
- `a11y.structure`: one `h1` and one `main` landmark per screen.

### Task flow and efficiency

- `flow.start-one-click`: Start practising is on the first screen of the home page and starts a run in one click.
- `flow.begin-gated`: the assessment begins only after the confirmation.
- `flow.reply-ack`: a sent reply clears the composer and locks the floor within 400 ms.
- `flow.feedback-fast`: practice feedback appears within 8 s of a reply (offline providers).
- `flow.ready-fast`: the first action is ready within 1.5 s of loading.
- `flow.no-dead-ends`: every screen has a way forward and a way back.

### Product rules and integrity

These mirror `CLAUDE.md`.

- `rules.ca-no-game`: Conversation AI never shows XP, badges, streaks, quests, levels or a leaderboard.
- `rules.ca-no-practice-tools`: Conversation AI offers no hints, Show what counts or Retry from here.
- `rules.end-confirm`: ending a call asks first; Keep talking takes focus, and Escape keeps the call and returns focus to End Call.
- `rules.ca-single-attempt`: after one attempt, a reload still shows the completed brief, never a new start.
- `rules.rp-run-cap`: practice stops after five runs.
- `rules.rung-with-score`: on the call and the report, the claim rung is shown wherever a score is shown. A pass mark on a brief is not a score.
- `rules.ratings-quoted`: every observed rating on the report shows the words it came from.
- `rules.feedback-each-reply`: practice gives feedback on every reply.
- `rules.criteria-on-request`: the behaviours behind each objective appear only after Show what counts.
- `rules.hints`: with hints on, a reply that misses an opportunity brings a hint, and it is still there when the player has the floor again.
- `rules.rewind`: Retry from here removes the reply and lets the player try it again.
- `rules.copy`: no em or en dashes on screen, and skills is the word used.

### Visual quality and layout

- `visual.no-sideways-scroll`: nothing scrolls sideways at any size.
- `visual.no-clipped`: no hidden overflow cuts text off (scrollable regions are fine).
- `visual.no-overlap`: no text overlaps other text. Text clipped away by a scroll region, lines of one heading with tight leading, and content of a closed disclosure are not counted.
- `visual.no-truncation`: no text is cut off by an ellipsis or a line clamp.
- `visual.fonts`: only the product fonts (Outfit and Inter) are in use.
- `visual.line-length`: no line of text runs past 100 characters.
- `visual.one-primary`: at most one primary action in view on the home, brief and report screens. Selected tabs and toggles are not actions.
- `visual.no-layout-shift`: cumulative layout shift below 0.05, by the Web Vitals definition (shifts within 500 ms of an input are excluded; the score is the worst session window). The log names the worst shift and its element.

### Robustness and performance

- `robust.no-errors`: no console errors, warnings or page errors.
- `robust.no-failed-requests`: no failed network requests.
- `robust.bundle`: initial JavaScript under 200 KB gzip per product (the PDF libraries load on demand).
- `robust.lcp`: largest contentful paint under 1.5 s.
- `robust.long-tasks`: no main thread task over 200 ms.

## Results

| Run | Score | Failing checks |
| --- | --- | --- |
| Baseline, this design before fixes | 51.5 | 21 of 45 |
| Final | 100 | 0 of 45 |

The final scorecard, and what was fixed to get there, is in `docs/eval-scorecard.md`.

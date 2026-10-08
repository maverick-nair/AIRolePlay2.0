# Product eval

`pnpm eval` scores AI RolePlay and Conversation AI against one rubric. It builds the app, serves it, drives the real player journeys in Chromium at laptop, tablet and phone sizes in both themes, measures every screen and writes a scorecard to `eval/results/latest.md` (and `latest.json`). It exits with code 1 when the score is below 100, so it can gate a release.

The eval checks what a player meets, not how the code is written. Unit tests cover the scoring engine; the eval covers the experience built on top of it.

## How to run

```
pnpm eval                       # full run, about 2.5 minutes
EVAL_PARALLEL=5 pnpm eval       # more journeys at once
EVAL_ONLY="laptop 1280" pnpm eval   # only the sizes whose name contains the text
EVAL_SHOTS=1 pnpm eval          # also save a screenshot of every measured state to eval/results/shots/
EVAL_BASE_URL=http://host pnpm eval # measure a running build instead of building one
EVAL_CHROMIUM=/path/to/chromium pnpm eval
```

A run with `EVAL_ONLY` skips the five run cap journey, so its score is partial by design.

## What it drives

- **Practice journey (AI RolePlay):** home, start in one click, a weak reply, Try again (rewind), two strong replies, What counts, Hint, End Call, Score now, the report, back home.
- **Assessment journey (Conversation AI):** the brief, Begin gated by the confirmation, the microphone and camera tests, the call, two replies, End Call with its confirmation dialog, Escape to cancel, End and score, the report, back to the brief, the completed state, a reload to prove the single attempt holds.
- **Run cap journey:** five quick practice runs, then the home screen must say practice is complete.

## Sizes

| Size | Themes | One frame rules |
| --- | --- | --- |
| Laptop 1513x745 | light, dark | yes |
| Laptop 1440x800 | light | yes |
| Laptop 1280x720 | light | yes |
| Laptop 1513x745, reduced motion | light | yes |
| Tablet 1180x820 | light, dark | yes |
| Tablet 820x1180 | light | yes |
| Phone 390x844 | light, dark | no, phones scroll |
| Reflow 320x640 | light | no, WCAG reflow only |

Keyboard walks run at one laptop, one tablet and one phone size.

## Scoring

Seven dimensions with fixed weights add up to 100. A check passes only when every instance of it passes on every screen and size where it applies. A dimension scores its weight times the share of its checks that pass.

| Dimension | Weight | Checks |
| --- | --- | --- |
| One frame per player screen | 20 | 5 |
| Everything the player needs is on screen | 15 | 5 |
| Accessibility (WCAG 2.2 AA) | 20 | 9 |
| Task flow and efficiency | 10 | 6 |
| Product rules and integrity | 15 | 12 |
| Visual quality and consistency | 10 | 6 |
| Robustness and performance | 10 | 5 |

## Checks

### One frame per player screen

- `frame.no-scroll`: on a laptop or tablet the home, brief and call screens never scroll, sideways or down. Only the live transcript may scroll.
- `frame.no-clipped-panels`: no card overflows, and no inner scroll region hides content (the transcript log is exempt).
- `frame.no-disclosure`: no `details`, tabs, collapsed `aria-expanded` controls or carousels on any screen. The Share menu is the one allowed menu, because it holds actions, not information.
- `frame.report-summary`: at every frame size the report shows the result, the rung, the next step and every skill score in the first frame.
- `frame.report-one-frame`: at 1513x745 and 1440x800 the whole report fits one frame.

### Everything the player needs is on screen

- `info.home`, `info.brief`, `info.call`: a manifest drawn from the scenario data (persona, scene, role, goal, challenge, every objective and skill, run setup, path, quests and badges in practice; terms, every instruction, devices and Begin in the assessment; goal, challenge, objectives and controls on the call) must be visible on the screen, not just in the DOM. On frame sizes it must also be inside the viewport.
- `info.timer`: the call timer is visible.
- `info.report`: every skill and every behaviour appears on the report and is visible.

### Accessibility

- `a11y.axe`: no axe violations for WCAG 2.0, 2.1 and 2.2 A and AA.
- `a11y.axe-best-practice`: no axe best practice violations.
- `a11y.focus-visible`: a keyboard walk through each screen finds a visible focus ring, in view, at every stop.
- `a11y.no-trap`: focus always moves on.
- `a11y.text-size`: no visible text below 12px.
- `a11y.target-size`: targets are at least 24 by 24 px or spaced (WCAG 2.5.8).
- `a11y.reduced-motion`: with reduced motion requested, nothing animates endlessly.
- `a11y.reflow`: at 320px wide nothing scrolls sideways (WCAG 1.4.10).
- `a11y.structure`: one `h1` and one `main` landmark per screen.

### Task flow and efficiency

- `flow.start-one-click`: a practice run starts with one click from the home screen.
- `flow.begin-gated`: the assessment begins only after the confirmation, in two actions.
- `flow.reply-ack`: a sent reply shows in the transcript within 400 ms.
- `flow.feedback-fast`: practice feedback appears within 8 s of a reply (offline providers).
- `flow.ready-fast`: the first action is ready within 1.5 s of loading.
- `flow.no-dead-ends`: every screen has a way forward and a way back.

### Product rules and integrity

These mirror `CLAUDE.md`.

- `rules.ca-no-game`: Conversation AI never shows XP, badges, streaks, quests, levels or a leaderboard.
- `rules.ca-no-practice-tools`: Conversation AI offers no Hint, What counts or Rewind.
- `rules.ca-confirm`: ending the assessment asks first, and Escape returns focus to End Call.
- `rules.ca-single-attempt`: after one attempt, a reload still shows the saved report, never a new start.
- `rules.rp-run-cap`: practice stops after five runs.
- `rules.rung-with-score`: the claim rung is shown wherever a score is shown.
- `rules.ratings-quoted`: every observed rating on the report shows the words and time it came from.
- `rules.feedback-each-reply`: practice gives feedback on every reply.
- `rules.criteria-on-request`, `rules.hint-on-request`: the behaviours and hints appear only when asked for.
- `rules.rewind`: Try again removes the last reply.
- `rules.copy`: no em or en dashes on screen, and skills is the word used.

### Visual quality and consistency

- `visual.no-overlap`: no text overlaps other text (inside an open dialog, only the dialog is checked; text under an opaque layer counts as covered, not overlapping).
- `visual.no-truncation`: no text is cut off by an ellipsis or a line clamp.
- `visual.consistency`: one card radius, one control radius and only the product's fonts.
- `visual.line-length`: no line of text runs past 100 characters.
- `visual.one-primary`: at most one primary action on the home, brief and report screens.
- `visual.no-layout-shift`: cumulative layout shift below 0.05. CLS follows the Web Vitals definition: shifts within 500 ms of an input are excluded, the rest are grouped into session windows (gaps under 1 s, windows under 5 s) and the score is the worst window. The log names the worst single shift and its element.

### Robustness and performance

- `robust.no-errors`: no console errors, warnings or page errors.
- `robust.no-failed-requests`: no failed network requests.
- `robust.bundle`: initial JavaScript under 200 KB gzip per product (the PDF libraries load on demand).
- `robust.lcp`: largest contentful paint under 1.5 s.
- `robust.long-tasks`: no main thread task over 200 ms.

## Decisions behind the rubric

- **Reports.** The home, brief and call screens hold a fixed amount of authored content, so they must fit one frame at every laptop and tablet size. A report holds as much evidence as the conversation produced, so it must fit one frame at the two main laptop sizes, and everywhere else its summary (result, rung, next step, every skill score) must be in the first frame, with all the evidence on the page and nothing behind a tab. The full transcript and coaching go in the PDF.
- **Layout shift.** The first version summed every shift over the whole single page session, which charged a player for content they had asked for minutes earlier. The eval now uses the standard Web Vitals definition above.
- **Phones.** Phones scroll as normal. Every check other than the one frame checks still applies there.

## Results

| Run | Score | Failing checks |
| --- | --- | --- |
| Baseline, before the work in this pass | 51.3 | 18 of 47 |
| Final | 100 | 0 of 48 |

The final scorecard is in `docs/eval-scorecard.md`. Two rubric changes happened between the two runs, both recorded above: the report rule was split into `frame.report-summary` (every size) and `frame.report-one-frame` (two laptop sizes), and CLS moved to the Web Vitals definition.

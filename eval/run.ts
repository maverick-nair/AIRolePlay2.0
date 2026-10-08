// Product eval for AI RolePlay and Conversation AI. Drives the real journeys in a browser across
// laptop, tablet and phone sizes in both themes, measures every screen, and scores the product
// against the rubric in docs/eval.md. Run with `pnpm eval`. Exit code 1 if the score is below 100.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { renewalNegotiation as scenario } from "../src/data/scenarios/renewalNegotiation";
import { BADGES } from "../src/data/badges";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const PROBES = join(ROOT, "eval", "probes.js");
const PORT = Number(process.env.EVAL_PORT ?? 4318);
const BASE = process.env.EVAL_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const EM = "\u2014";
const EN = "\u2013";
const BANNED_WORD = new RegExp("compet" + "enc", "i");

// ---------------------------------------------------------------- rubric
type Dim = "info" | "a11y" | "flow" | "rules" | "visual" | "robust";
const DIMS: Record<Dim, { title: string; weight: number }> = {
  info: { title: "Everything the player needs is there", weight: 15 },
  a11y: { title: "Accessibility (WCAG 2.2 AA)", weight: 25 },
  flow: { title: "Task flow and efficiency", weight: 15 },
  rules: { title: "Product rules and integrity", weight: 20 },
  visual: { title: "Visual quality and layout", weight: 15 },
  robust: { title: "Robustness and performance", weight: 10 },
};
const CHECKS: Record<string, { dim: Dim; title: string }> = {
  "info.home": {
    dim: "info",
    title: "AI RolePlay home shows the persona, brief, objectives, skills, run setup and progress",
  },
  "info.brief": {
    dim: "info",
    title: "Conversation AI brief shows the role, goal, situation, challenge, skills, rules and begin",
  },
  "info.call": { dim: "info", title: "Calls show the scenario, objectives, controls and transcript" },
  "info.timer": { dim: "info", title: "The call timer is visible" },
  "info.report": {
    dim: "info",
    title: "Reports show the score, pass mark, rung, every skill and every behaviour",
  },
  "a11y.axe": { dim: "a11y", title: "axe: no WCAG 2.0, 2.1 or 2.2 A or AA violations" },
  "a11y.axe-best-practice": { dim: "a11y", title: "axe: no best practice violations" },
  "a11y.focus-visible": { dim: "a11y", title: "Every keyboard stop shows a visible focus indicator in view" },
  "a11y.no-trap": { dim: "a11y", title: "Keyboard focus is never trapped" },
  "a11y.text-size": { dim: "a11y", title: "No visible text below 12px" },
  "a11y.target-size": { dim: "a11y", title: "Targets at least 24 by 24 px or spaced (2.5.8)" },
  "a11y.reduced-motion": { dim: "a11y", title: "No endless motion when reduced motion is requested" },
  "a11y.reflow": { dim: "a11y", title: "Reflow at 320 px: no sideways scroll (1.4.10)" },
  "a11y.structure": { dim: "a11y", title: "One h1 and one main landmark per screen" },
  "flow.start-one-click": {
    dim: "flow",
    title: "A practice run starts in one click from the first screen of the home page",
  },
  "flow.begin-gated": { dim: "flow", title: "The assessment starts only after confirmation" },
  "flow.reply-ack": { dim: "flow", title: "A reply is acknowledged within 400 ms" },
  "flow.feedback-fast": { dim: "flow", title: "Practice feedback appears within 8 s of a reply" },
  "flow.ready-fast": { dim: "flow", title: "The first action is ready within 1.5 s of loading" },
  "flow.no-dead-ends": { dim: "flow", title: "Every screen has a way forward and a way back" },
  "rules.ca-no-game": { dim: "rules", title: "Conversation AI shows no game layer" },
  "rules.ca-no-practice-tools": {
    dim: "rules",
    title: "Conversation AI offers no hints, criteria or rewind",
  },
  "rules.end-confirm": {
    dim: "rules",
    title: "Ending a call asks first, Escape keeps the call and returns focus",
  },
  "rules.ca-single-attempt": { dim: "rules", title: "The assessment cannot be retaken" },
  "rules.rp-run-cap": { dim: "rules", title: "Practice stops after five runs" },
  "rules.rung-with-score": { dim: "rules", title: "The claim rung is shown wherever a score is shown" },
  "rules.ratings-quoted": {
    dim: "rules",
    title: "Every observed rating shows the words it came from",
  },
  "rules.feedback-each-reply": { dim: "rules", title: "Practice gives feedback on every reply" },
  "rules.criteria-on-request": { dim: "rules", title: "Practice criteria appear on request" },
  "rules.hints": { dim: "rules", title: "With hints on, a missed opportunity brings a hint" },
  "rules.rewind": { dim: "rules", title: "Retry from here rewinds the reply" },
  "rules.no-seeded-progress": {
    dim: "rules",
    title: "A first time learner starts at zero: no XP, streak or rank before the first run",
  },
  "rules.copy": { dim: "rules", title: "No em or en dashes, and skills is the word used" },
  "visual.no-sideways-scroll": { dim: "visual", title: "No sideways scroll at any size" },
  "visual.no-clipped": { dim: "visual", title: "No region clips or hides content in a hidden overflow" },
  "visual.no-overlap": { dim: "visual", title: "No overlapping text" },
  "visual.no-truncation": { dim: "visual", title: "No text cut off by ellipsis or clamp" },
  "visual.fonts": { dim: "visual", title: "Only the product fonts are in use" },
  "visual.line-length": { dim: "visual", title: "Lines of text stay under 100 characters" },
  "visual.one-primary": {
    dim: "visual",
    title: "At most one primary action in view on home, brief and report screens",
  },
  "visual.no-layout-shift": { dim: "visual", title: "Cumulative layout shift below 0.05" },
  "robust.no-errors": { dim: "robust", title: "No console errors, warnings or page errors" },
  "robust.no-failed-requests": { dim: "robust", title: "No failed requests" },
  "robust.bundle": { dim: "robust", title: "Initial JavaScript under 200 KB gzip per product" },
  "robust.lcp": { dim: "robust", title: "Largest contentful paint under 1.5 s" },
  "robust.long-tasks": { dim: "robust", title: "No main thread task over 200 ms" },
};
const failures = new Map<string, string[]>();
const ran = new Set<string>();
function check(id: string, ok: boolean, where: string, detail = "") {
  if (!CHECKS[id]) throw new Error(`unknown check ${id}`);
  ran.add(id);
  if (!ok) {
    const list = failures.get(id) ?? [];
    if (list.length < 40) list.push(detail ? `${where}: ${detail}` : where);
    failures.set(id, list);
  }
}
const checkList = (id: string, issues: string[], where: string) =>
  check(id, issues.length === 0, where, issues.slice(0, 6).join("; "));

// ---------------------------------------------------------------- what each screen must show
const player = scenario.stimulus.player;
const persona = scenario.stimulus.persona;
const objectives = scenario.instrument.objectives;
const skills = scenario.instrument.skills;
const MANIFEST: Record<string, string[]> = {
  "rp-home": [
    scenario.title.split(" ").slice(-2).join(" "),
    persona.name,
    persona.role,
    player.scene,
    player.role,
    player.goal,
    player.challenge,
    ...objectives.flatMap((o) => [o.label, o.sub]),
    ...skills.flatMap((s) => [s.name, s.desc]),
    "Measured",
    "Firm",
    "Hardball",
    "Show hints",
    "Start practising",
    ...BADGES.map((b) => b.name),
    "Practice Runs",
    "Feedback status",
  ],
  "ca-brief": [
    scenario.title,
    persona.name,
    player.role,
    player.goal,
    player.scene,
    player.challenge,
    ...skills.flatMap((s) => [s.name, s.desc]),
    "One attempt",
    "Hidden criteria",
    "Pass mark",
    "I understand this is a single, timed attempt",
    "Begin the assessment",
  ],
  "rp-call": [scenario.title, ...objectives.map((o) => o.label), "End Call", "Transcript"],
  "ca-call": [scenario.title, ...objectives.map((o) => o.label), "End Call", "Transcript"],
};

// Below 1024px the call's side panels (objectives, transcript) open from the top bar, and below 640px
// the badge shelf is left out of the home page, so those items are not required there.
const required = (state: string, item: string, w: number) =>
  state.includes("call")
    ? w >= 1024 || ![...objectives.map((o) => o.label), "Transcript"].includes(item)
    : w >= 640 || !BADGES.some((b) => b.name === item);

// ---------------------------------------------------------------- combos
type Combo = {
  name: string;
  w: number;
  h: number;
  theme: "light" | "dark";
  wide: boolean; // laptop or tablet
  keyboard: boolean;
  reduced?: boolean;
  reflow?: boolean;
};
const COMBOS: Combo[] = [
  { name: "laptop 1513x745 dark", w: 1513, h: 745, theme: "dark", wide: true, keyboard: true },
  { name: "laptop 1513x745 light", w: 1513, h: 745, theme: "light", wide: true, keyboard: true },
  { name: "laptop 1440x800 dark", w: 1440, h: 800, theme: "dark", wide: true, keyboard: false },
  { name: "laptop 1280x720 dark", w: 1280, h: 720, theme: "dark", wide: true, keyboard: false },
  { name: "tablet 1180x820 dark", w: 1180, h: 820, theme: "dark", wide: true, keyboard: true },
  { name: "tablet 1180x820 light", w: 1180, h: 820, theme: "light", wide: true, keyboard: false },
  { name: "tablet 820x1180 dark", w: 820, h: 1180, theme: "dark", wide: true, keyboard: true },
  { name: "phone 390x844 dark", w: 390, h: 844, theme: "dark", wide: false, keyboard: true },
  { name: "phone 390x844 light", w: 390, h: 844, theme: "light", wide: false, keyboard: false },
  { name: "reflow 320x640 dark", w: 320, h: 640, theme: "dark", wide: false, keyboard: false, reflow: true },
  {
    name: "laptop reduced motion",
    w: 1513,
    h: 745,
    theme: "dark",
    wide: true,
    keyboard: false,
    reduced: true,
  },
];
const MAIN = COMBOS[0].name;

// ---------------------------------------------------------------- page helpers
type Ctx = { combo: Combo; page: Page; errors: string[]; failed: string[] };
async function open(browser: Browser, combo: Combo, path: string): Promise<Ctx> {
  const context = await browser.newContext({
    viewport: { width: combo.w, height: combo.h },
    reducedMotion: combo.reduced ? "reduce" : "no-preference",
    permissions: ["microphone", "camera"],
  });
  await context.addInitScript({ path: PROBES });
  const page = await context.newPage();
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text().slice(0, 120)}`);
  });
  page.on("pageerror", (e) => errors.push(`page error: ${e.message.slice(0, 120)}`));
  page.on("requestfailed", (r) => failed.push(`${r.url().slice(0, 80)} ${r.failure()?.errorText ?? ""}`));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  const t0 = Date.now();
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  const ready = Date.now() - t0;
  if (combo.name === MAIN) check("flow.ready-fast", ready < 1500, `${path} ${combo.name}`, `${ready} ms`);
  // Both products open dark; light is the toggle.
  if (combo.theme === "light") await page.getByRole("button", { name: /Switch to light theme/ }).click();
  return { combo, page, errors, failed };
}
const ev = <T>(page: Page, expr: string) => page.evaluate(expr) as Promise<T>;
// Which of these texts are not visible (and, when asked, not inside the viewport)?
const missing = (page: Page, items: string[], viewport: boolean) =>
  page.evaluate(
    ([list, v]) =>
      (window as never as { __eval: { missing(i: string[], o: unknown): string[] } }).__eval.missing(list, {
        viewport: v,
      }),
    [items, viewport] as const,
  );

const composer = (page: Page) => page.locator("textarea").first();
async function waitYourTurn(page: Page) {
  await page.waitForTimeout(250);
  await page.waitForFunction(
    () => {
      const t = document.querySelector("textarea");
      return !!t && !t.disabled;
    },
    undefined,
    { timeout: 20000 },
  );
}
// Send a reply. Returns the time to the feedback status (practice) or to the floor reopening.
async function reply(c: Ctx, text: string, expectFeedback: boolean) {
  const { page } = c;
  await waitYourTurn(page);
  await composer(page).fill(text);
  const t0 = Date.now();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => {
      const ta = document.querySelector("textarea");
      return !!ta && ta.value === "" && ta.disabled;
    },
    undefined,
    { timeout: 5000 },
  );
  const ack = Date.now() - t0;
  check("flow.reply-ack", ack < 400, c.combo.name, `${ack} ms`);
  let feedbackMs = -1;
  if (expectFeedback) {
    feedbackMs = await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("[role=status]")].some((s) =>
            /\+\d+ XP|No XP/.test((s as HTMLElement).innerText),
          ),
        undefined,
        { timeout: 8000 },
      )
      .then(() => Date.now() - t0)
      .catch(() => -1);
  }
  await waitYourTurn(page);
  return feedbackMs;
}
const youTurns = (page: Page) => page.locator('[data-speaker="you"]').count();

// End the call: through the confirmation when there is one.
async function endCall(c: Ctx, where: string) {
  const { page } = c;
  await page.getByRole("button", { name: "End Call" }).click();
  const dialog = page.getByRole("alertdialog");
  const shown = await dialog.isVisible().catch(() => false);
  if (shown) {
    const focus1 = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    await audit(c, `${where}-confirm`, "overlay");
    await page.keyboard.press("Escape");
    const stillOpen = await dialog.isVisible().catch(() => false);
    const focus2 = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    const ok = focus1 === "Keep talking" && !stillOpen && focus2 === "End Call";
    check("rules.end-confirm", ok, `${where} @ ${c.combo.name}`, `focus ${focus1} then ${focus2}`);
    await page.getByRole("button", { name: "End Call" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^End and score/ })
      .click();
  } else {
    check("rules.end-confirm", false, `${where} @ ${c.combo.name}`, "the call ended without asking");
  }
  await page.waitForSelector("[role=tablist]", { timeout: 30000 });
}

// Measure one screen state.
async function audit(c: Ctx, state: string, kind: "player" | "report" | "overlay", manifest?: string[]) {
  const { page, combo } = c;
  const where = `${state} @ ${combo.name}`;
  await page.waitForTimeout(700); // let entrance animations settle
  if (process.env.EVAL_SHOTS) {
    const dir = join(ROOT, "eval", "results", "shots");
    mkdirSync(dir, { recursive: true });
    await page.screenshot({
      path: join(dir, `${state} ${combo.name}.png`.replace(/\s+/g, "-")),
      fullPage: kind !== "overlay",
    });
  }
  const layout = await ev<{ sideways: number; clipped: string[] }>(page, "window.__eval.layout()");
  check("visual.no-sideways-scroll", layout.sideways <= 1, where, `${layout.sideways}px`);
  if (kind !== "overlay") checkList("visual.no-clipped", layout.clipped, where);
  if (manifest) manifest = manifest.filter((m) => required(state, m, combo.w));
  if (manifest) {
    const id = state.startsWith("rp-home")
      ? "info.home"
      : state.startsWith("ca-brief")
        ? "info.brief"
        : state.includes("call")
          ? "info.call"
          : "info.report";
    checkList(id, await missing(page, manifest, false), where);
  }
  if (state.includes("call") && kind === "player") {
    const timer = await page
      .locator("text=/^\\d{1,2}:\\d\\d$/")
      .first()
      .isVisible()
      .catch(() => false);
    check("info.timer", timer, where, "no visible mm:ss timer");
  }

  // axe
  await page.evaluate(AXE);
  const axe = await page.evaluate(async () => {
    const w = window as never as {
      axe: {
        run(
          c: unknown,
          o: unknown,
        ): Promise<{ violations: { id: string; tags: string[]; nodes: { target: string[] }[] }[] }>;
      };
    };
    const r = await w.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({
      id: v.id,
      tags: v.tags,
      node: String(v.nodes[0]?.target?.[0] ?? ""),
      n: v.nodes.length,
    }));
  });
  const wcag = axe.filter((v) => v.tags.some((t) => /^wcag2(a|aa|1a|1aa|2a|2aa)$/.test(t)));
  const bp = axe.filter((v) => !wcag.includes(v) && v.tags.includes("best-practice"));
  checkList(
    "a11y.axe",
    wcag.map((v) => `${v.id} x${v.n} ${v.node}`),
    where,
  );
  checkList(
    "a11y.axe-best-practice",
    bp.map((v) => `${v.id} x${v.n} ${v.node}`),
    where,
  );
  checkList("a11y.text-size", await ev<string[]>(page, "window.__eval.smallText()"), where);
  checkList("a11y.target-size", await ev<string[]>(page, "window.__eval.smallTargets()"), where);
  if (kind !== "overlay") {
    const counts = await ev<{ h1: number; main: number }>(page, "window.__eval.counts()");
    check(
      "a11y.structure",
      counts.h1 === 1 && counts.main === 1,
      where,
      `${counts.h1} h1, ${counts.main} main`,
    );
  }
  if (combo.reduced)
    checkList("a11y.reduced-motion", await ev<string[]>(page, "window.__eval.endlessMotion()"), where);
  if (combo.reflow) check("a11y.reflow", layout.sideways <= 1, where, `${layout.sideways}px sideways`);

  // visual
  checkList("visual.no-overlap", await ev<string[]>(page, "window.__eval.overlaps()"), where);
  checkList("visual.no-truncation", await ev<string[]>(page, "window.__eval.truncated()"), where);
  checkList("visual.fonts", await ev<string[]>(page, "window.__eval.fonts()"), where);
  checkList("visual.line-length", await ev<string[]>(page, "window.__eval.longLines()"), where);
  if (/home|brief|report/.test(state) && kind !== "overlay") {
    const p = await ev<string[]>(page, "window.__eval.primaries()");
    check("visual.one-primary", p.length <= 1, where, p.join(", "));
  }
  const perf = await ev<{ cls: number; worst: string }>(page, "window.__eval.perf()");
  check(
    "visual.no-layout-shift",
    perf.cls < 0.05,
    where,
    `CLS ${perf.cls.toFixed(3)}, worst shift ${perf.worst}`,
  );

  // copy and product rules on visible text
  const text = await ev<string>(page, "window.__eval.text()");
  const copy: string[] = [];
  if (text.includes(EM)) copy.push("em dash");
  if (text.includes(EN)) copy.push("en dash");
  if (BANNED_WORD.test(text)) copy.push("uses the banned word, not skills");
  checkList("rules.copy", copy, where);
  if (state.startsWith("ca-")) {
    const game = text.match(/\b(XP|badges?|streak|quests?|level up|leaderboard)\b/gi) ?? [];
    check("rules.ca-no-game", game.length === 0, where, [...new Set(game)].join(", "));
  }
  // A participant score (not a pass mark on a brief) must carry the rung.
  if (/report|call/.test(state) && /\b\d{1,2}\s?\/\s?10\b/.test(text))
    check("rules.rung-with-score", /rung\s*\d/i.test(text), where, "score without rung");

  // keyboard
  if (combo.keyboard && kind !== "overlay") await keyboardWalk(c, where);
}

async function keyboardWalk(c: Ctx, where: string) {
  const { page } = c;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.evaluate(() => window.scrollTo(0, 0));
  const seen: string[] = [];
  const bad: string[] = [];
  let trapped = false;
  for (let i = 0; i < 90; i++) {
    await page.keyboard.press("Tab");
    const f = await ev<{ body: boolean; key?: string; id?: string; ring?: boolean; inView?: boolean }>(
      page,
      "window.__eval.focusInfo()",
    );
    if (f.body) break;
    if (!f.ring) bad.push(`${f.id} has no focus ring`);
    else if (!f.inView) bad.push(`${f.id} focused outside the view`);
    seen.push(f.key ?? "");
    if (i > 5 && seen.slice(-4).every((x) => x === seen[seen.length - 1])) {
      trapped = true;
      break;
    }
  }
  checkList("a11y.focus-visible", [...new Set(bad)], where);
  check("a11y.no-trap", !trapped, where, "focus stuck");
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

// ---------------------------------------------------------------- journeys
async function practiceJourney(browser: Browser, combo: Combo) {
  const c = await open(browser, combo, "/");
  const { page } = c;
  const main = combo.name === MAIN;
  await audit(c, "rp-home", "player", MANIFEST["rp-home"]);
  const homeText = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check(
    "rules.no-seeded-progress",
    /Season XP 0\b/i.test(homeText) && /None yet/.test(homeText),
    `rp-home ${combo.name}`,
    homeText.match(/Level .{0,120}/i)?.[0] ?? "no progress strip",
  );
  const start = page.getByRole("button", { name: /^Start practising/ }).first();
  const box = await start.boundingBox();
  check(
    "flow.start-one-click",
    !!box && box.y + box.height <= combo.h && (await start.isEnabled()),
    combo.name,
    "Start is not ready on the first screen",
  );
  await start.click();
  await waitYourTurn(page);
  await audit(c, "rp-call-start", "player", MANIFEST["rp-call"]);
  if (combo.w >= 768) {
    const hud = (await page.locator("header").innerText()).replace(/\s+/g, " ");
    check("rules.no-seeded-progress", /\b0 XP\b/.test(hud), `rp-call ${combo.name}`, hud.slice(0, 120));
  }

  // A weak reply: with hints on it should bring a hint; Retry from here rewinds it.
  const fb0 = await reply(c, "We can match their price.", true);
  if (main) {
    const hint = await page
      .locator('[role=status]:has-text("Hint")')
      .first()
      .isVisible()
      .catch(() => false);
    check("rules.hints", hint, combo.name, "no hint after a missed opportunity");
    const before = await youTurns(page);
    const retry = page.getByRole("button", { name: /^Retry from/ }).last();
    const offered = await retry.isVisible().catch(() => false);
    if (offered) {
      await retry.click();
      await page.waitForTimeout(500);
    }
    const after = await youTurns(page);
    check(
      "rules.rewind",
      offered && after === before - 1,
      combo.name,
      `offered ${offered}, ${before} to ${after}`,
    );
    await composer(page).fill("");
  }
  const fb1 = await reply(c, "Before we talk price, what does your CFO need to see this year?", true);
  const fb2 = await reply(c, "What would switching cost your team in the first quarter?", true);
  check(
    "rules.feedback-each-reply",
    [fb0, fb1, fb2].every((x) => x >= 0),
    combo.name,
    `feedback ms ${[fb0, fb1, fb2].join(", ")}`,
  );
  check("flow.feedback-fast", fb1 >= 0 && fb1 < 8000, combo.name, `${fb1} ms`);

  // Criteria on request, from the objectives panel.
  if (main) {
    const criteria = scenario.instrument.skills
      .flatMap((s) => s.indicators)
      .filter((i) => objectives[0].indicatorIds.includes(i.id))
      .map((i) => i.label);
    const shownBefore = (await missing(page, criteria, false)).length < criteria.length;
    await page.getByRole("button", { name: /^Show what counts/ }).click();
    const missingAfter = await missing(page, criteria, false);
    check(
      "rules.criteria-on-request",
      !shownBefore && missingAfter.length === 0,
      combo.name,
      `before ${shownBefore}, missing after ${missingAfter.join("; ")}`,
    );
  }
  await audit(c, "rp-call-busy", "player", MANIFEST["rp-call"]);
  check(
    "flow.no-dead-ends",
    await page.getByRole("button", { name: "End Call" }).isVisible(),
    `rp-call ${combo.name}`,
    "no End Call",
  );

  await endCall(c, "rp-call");
  await reportChecks(c, "rp-report");
  const back = page.getByRole("button", { name: /Back to AI RolePlay/ }).first();
  check(
    "flow.no-dead-ends",
    (await back.count()) > 0 && (await page.getByRole("button", { name: "Practise again" }).count()) > 0,
    `rp-report ${combo.name}`,
    "missing back or practise again",
  );
  await back.click();
  await page.waitForTimeout(400);
  await audit(c, "rp-home-after", "player", [...MANIFEST["rp-home"], "Best"]);
  await finish(c);
}

async function reportChecks(c: Ctx, state: string) {
  const { page } = c;
  const report = await page.evaluate(() => {
    const raw = localStorage.getItem("gk.roleplay.attempts.v1");
    const list = raw ? JSON.parse(raw) : [];
    return list[list.length - 1];
  });
  const where = `${state} @ ${c.combo.name}`;
  // Overview: score, pass mark and rung.
  await audit(c, state, "report", ["Rung 1", "pass mark", "/10"]);
  // Evidence: every skill and behaviour, every observed rating with its words.
  await page.getByRole("tab", { name: /Evidence by Skill/ }).click();
  await page.waitForTimeout(300);
  const labels: string[] = [];
  const quotes: string[] = [];
  const skillMissing: string[] = [];
  for (const s of report.scores.skills) {
    const head = page.getByRole("button", { name: new RegExp(`^\\d+\\s*${s.name}`) }).first();
    if ((await head.getAttribute("aria-expanded")) === "false") await head.click();
    await page.waitForTimeout(700); // the panel fades in
    const items = [s.name, ...s.indicators.map((i: { label: string }) => i.label)];
    const q = s.indicators.flatMap((i: { evidence: { quote: string }[] }) =>
      i.evidence.map((e) => e.quote.slice(0, 40)),
    );
    labels.push(...items);
    quotes.push(...q);
    skillMissing.push(...(await missing(page, items, false)));
    checkList("rules.ratings-quoted", await missing(page, [...new Set(q)] as string[], false), where);
  }
  checkList("info.report", skillMissing, where);
  await audit(c, `${state}-evidence`, "report");
  for (const t of ["Communication", "Transcript"]) {
    await page.getByRole("tab", { name: t }).click();
    await page.waitForTimeout(300);
    await audit(c, `${state}-${t.toLowerCase()}`, "report");
  }
  await page.getByRole("tab", { name: /Performance Overview/ }).click();
}

async function assessmentJourney(browser: Browser, combo: Combo) {
  const c = await open(browser, combo, "/assess/");
  const { page } = c;
  await audit(c, "ca-brief", "player", MANIFEST["ca-brief"]);
  const begin = page.getByRole("button", { name: "Begin the assessment" });
  const gated = !(await begin.isEnabled());
  await page.locator("input[type=checkbox]").first().check();
  check("flow.begin-gated", gated && (await begin.isEnabled()), combo.name, "Begin is not gated");
  await begin.click();
  await waitYourTurn(page);
  await audit(c, "ca-call", "player", MANIFEST["ca-call"]);
  const tools = await page
    .getByRole("button", { name: /^(Hint|Show what counts|Rewind|Try again)|Retry from/ })
    .count();
  check("rules.ca-no-practice-tools", tools === 0, combo.name, `${tools} practice controls`);
  await reply(c, "Before we talk price, what does your CFO need to see this year?", false);
  await reply(c, "What would switching cost your team in the first quarter?", false);
  await audit(c, "ca-call-busy", "player", MANIFEST["ca-call"]);
  await endCall(c, "ca-call");
  await reportChecks(c, "ca-report");
  const back = page.getByRole("button", { name: /Back to assessment/ }).first();
  check("flow.no-dead-ends", (await back.count()) > 0, `ca-report ${combo.name}`, "no way back");
  await back.click();
  await page.waitForTimeout(400);
  await audit(c, "ca-brief-completed", "player", ["Assessment complete", "Open the report", player.goal]);
  const retake = await page.getByRole("button", { name: "Begin the assessment" }).count();
  await page.reload();
  await page.waitForLoadState("networkidle");
  const still = await page.getByText("Assessment complete").isVisible();
  check(
    "rules.ca-single-attempt",
    retake === 0 && still,
    combo.name,
    `begin buttons ${retake}, completed after reload ${still}`,
  );
  await finish(c);
}

async function runCapJourney(browser: Browser) {
  const combo = COMBOS[0];
  const c = await open(browser, combo, "/");
  const { page } = c;
  for (let i = 1; i <= scenario.maxPracticeAttempts; i++) {
    await page
      .getByRole("button", { name: /^Start practising/ })
      .first()
      .click();
    await waitYourTurn(page);
    await page.getByRole("button", { name: "End Call" }).click();
    const confirm = page.getByRole("alertdialog").getByRole("button", { name: /^End and score/ });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await page.waitForSelector("[role=tablist]", { timeout: 30000 });
    const again = await page.getByRole("button", { name: "Practise again" }).count();
    if (i === scenario.maxPracticeAttempts)
      check("rules.rp-run-cap", again === 0, combo.name, "Practise again offered after the last run");
    await page
      .getByRole("button", { name: /Back to AI RolePlay/ })
      .first()
      .click();
    await page.waitForTimeout(300);
  }
  const used = page.getByRole("button", { name: `All ${scenario.maxPracticeAttempts} runs used` });
  const startLeft = await page.getByRole("button", { name: /^Start practising/ }).count();
  check(
    "rules.rp-run-cap",
    (await used.count()) > 0 && !(await used.first().isEnabled()) && startLeft === 0,
    combo.name,
    `start buttons left ${startLeft}`,
  );
  const perf = await ev<{ lcp: number; longTasks: number[] }>(page, "window.__eval.perf()");
  check(
    "robust.long-tasks",
    perf.longTasks.every((t) => t <= 200),
    combo.name,
    perf.longTasks.filter((t) => t > 200).join(", ") + " ms",
  );
  await finish(c);
}

function finish(c: Ctx): Promise<void> {
  check(
    "robust.no-errors",
    c.errors.length === 0,
    c.combo.name,
    [...new Set(c.errors)].slice(0, 4).join("; "),
  );
  check(
    "robust.no-failed-requests",
    c.failed.length === 0,
    c.combo.name,
    [...new Set(c.failed)].slice(0, 4).join("; "),
  );
  return c.page
    .context()
    .close()
    .catch(() => {});
}

async function loadMetrics(browser: Browser) {
  for (const path of ["/", "/assess/"]) {
    const c = await open(browser, COMBOS[0], path);
    await c.page.waitForTimeout(800);
    const perf = await ev<{ lcp: number; longTasks: number[] }>(c.page, "window.__eval.perf()");
    check("robust.lcp", perf.lcp > 0 && perf.lcp < 1500, path, `${Math.round(perf.lcp)} ms`);
    check(
      "robust.long-tasks",
      perf.longTasks.every((t) => t <= 200),
      `load ${path}`,
      perf.longTasks.join(", ") + " ms",
    );
    await finish(c);
  }
}

function bundleCheck() {
  for (const [entry, html] of [
    ["AI RolePlay", "dist/index.html"],
    ["Conversation AI", "dist/assess/index.html"],
  ]) {
    const src = readFileSync(join(ROOT, html), "utf8");
    const files = [...src.matchAll(/(?:src|href)="[^"]*?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
    const bytes = files.reduce((a, f) => a + gzipSync(readFileSync(join(ROOT, "dist", f))).length, 0);
    check("robust.bundle", bytes < 200 * 1024, entry, `${Math.round(bytes / 1024)} KB gzip`);
  }
}

// ---------------------------------------------------------------- server and run
async function startServer(): Promise<ChildProcess | null> {
  if (process.env.EVAL_BASE_URL) return null;
  const vite = join(ROOT, "node_modules", ".bin", "vite");
  await new Promise<void>((res, rej) => {
    const b = spawn(vite, ["build"], {
      cwd: ROOT,
      stdio: "ignore",
      env: { ...process.env, VITE_BUILD: "eval" },
    });
    b.on("exit", (code) => (code === 0 ? res() : rej(new Error("build failed"))));
  });
  const server = spawn(vite, ["preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return server;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("preview server did not start");
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
        const t0 = Date.now();
        try {
          await fn(t);
          console.error(
            `done ${String((t as { label?: string }).label ?? "")} in ${Math.round((Date.now() - t0) / 1000)} s`,
          );
        } catch (e) {
          console.error("journey failed:", (e as Error).message.split("\n")[0]);
          check("robust.no-errors", false, "journey", (e as Error).message.split("\n")[0].slice(0, 160));
        }
      }
    }),
  );
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.EVAL_CHROMIUM || undefined,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const started = Date.now();
  try {
    if (!process.env.EVAL_BASE_URL) bundleCheck();
    await loadMetrics(browser);
    const only = process.env.EVAL_ONLY;
    const combos = only ? COMBOS.filter((c) => c.name.includes(only)) : COMBOS;
    const jobs = [
      ...combos.map((c) => ({ label: `practice ${c.name}`, run: () => practiceJourney(browser, c) })),
      ...combos.map((c) => ({ label: `assessment ${c.name}`, run: () => assessmentJourney(browser, c) })),
      ...(only ? [] : [{ label: "practice run cap", run: () => runCapJourney(browser) }]),
    ];
    await pool(jobs, Number(process.env.EVAL_PARALLEL ?? 4), (j) => j.run());
  } finally {
    await browser.close();
    server?.kill();
  }

  // ---------------------------------------------------------------- score
  const dims = (Object.keys(DIMS) as Dim[]).map((d) => {
    const ids = Object.keys(CHECKS).filter((id) => CHECKS[id].dim === d);
    const passed = ids.filter((id) => ran.has(id) && !failures.has(id));
    return { d, ids, passed, score: (DIMS[d].weight * passed.length) / ids.length };
  });
  const total = Math.round(dims.reduce((a, x) => a + x.score, 0) * 10) / 10;
  const lines = [
    `# Product eval scorecard`,
    ``,
    `Score: **${total} / 100**. ${Object.keys(CHECKS).length} checks, ${failures.size} failing. Run took ${Math.round((Date.now() - started) / 1000)} s.`,
    ``,
    `| Dimension | Weight | Checks passed | Score |`,
    `| --- | --- | --- | --- |`,
    ...dims.map(
      (x) =>
        `| ${DIMS[x.d].title} | ${DIMS[x.d].weight} | ${x.passed.length} of ${x.ids.length} | ${x.score.toFixed(1)} |`,
    ),
    ``,
    `## Checks`,
    ``,
    ...Object.entries(CHECKS).map(([id, c]) => {
      const f = failures.get(id);
      const status = !ran.has(id) ? "NOT RUN" : f ? "FAIL" : "pass";
      return `- ${status}: \`${id}\` ${c.title}${
        f
          ? "\n" +
            f
              .slice(0, 8)
              .map((x) => `  - ${x}`)
              .join("\n")
          : ""
      }`;
    }),
  ];
  const outDir = join(ROOT, "eval", "results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "latest.md"), lines.join("\n") + "\n");
  writeFileSync(
    join(outDir, "latest.json"),
    JSON.stringify(
      {
        total,
        dims: dims.map((x) => ({ dim: x.d, score: x.score, passed: x.passed.length, of: x.ids.length })),
        failures: Object.fromEntries(failures),
        notRun: Object.keys(CHECKS).filter((id) => !ran.has(id)),
      },
      null,
      2,
    ),
  );
  console.log(lines.join("\n"));
  process.exit(total < 100 ? 1 : 0);
}

process.on("unhandledRejection", (e) => {
  if (!/closed/i.test(String(e))) console.error("unhandled:", e);
});
void main();

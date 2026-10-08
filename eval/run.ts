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
import { weeklyQuests } from "../src/lib/progress";

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
type Dim = "frame" | "info" | "a11y" | "flow" | "rules" | "visual" | "robust";
const DIMS: Record<Dim, { title: string; weight: number }> = {
  frame: { title: "One frame per player screen", weight: 20 },
  info: { title: "Everything the player needs is on screen", weight: 15 },
  a11y: { title: "Accessibility (WCAG 2.2 AA)", weight: 20 },
  flow: { title: "Task flow and efficiency", weight: 10 },
  rules: { title: "Product rules and integrity", weight: 15 },
  visual: { title: "Visual quality and consistency", weight: 10 },
  robust: { title: "Robustness and performance", weight: 10 },
};
const CHECKS: Record<string, { dim: Dim; title: string }> = {
  "frame.no-scroll": { dim: "frame", title: "No page or frame scroll on laptop and tablet" },
  "frame.no-clipped-panels": { dim: "frame", title: "No panel overflows or clips its content" },
  "frame.no-disclosure": { dim: "frame", title: "No tabs, accordions, collapsed sections or carousels" },
  "frame.report-summary": {
    dim: "frame",
    title: "Reports show the result, rung, next step and every skill score in the first frame",
  },
  "frame.report-one-frame": { dim: "frame", title: "Reports fit one frame at 1513x745 and 1440x800" },
  "info.home": {
    dim: "info",
    title: "AI RolePlay home shows the full brief, scoring, run setup and progress",
  },
  "info.brief": {
    dim: "info",
    title: "Conversation AI brief shows the brief, skills, instructions, devices and begin",
  },
  "info.call": { dim: "info", title: "Calls show the goal, challenge, objectives, controls and transcript" },
  "info.timer": { dim: "info", title: "The call timer is visible" },
  "info.report": {
    dim: "info",
    title: "Reports show every skill and every behaviour, with nothing hidden",
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
  "flow.start-one-click": { dim: "flow", title: "A practice run starts in one click from the home screen" },
  "flow.begin-gated": { dim: "flow", title: "The assessment starts only after confirmation, in two actions" },
  "flow.reply-ack": { dim: "flow", title: "A reply is acknowledged within 400 ms" },
  "flow.feedback-fast": { dim: "flow", title: "Practice feedback appears within 8 s of a reply" },
  "flow.ready-fast": { dim: "flow", title: "The first action is ready within 1.5 s of loading" },
  "flow.no-dead-ends": { dim: "flow", title: "Every screen has a way forward and a way back" },
  "rules.ca-no-game": { dim: "rules", title: "Conversation AI shows no game layer" },
  "rules.ca-no-practice-tools": {
    dim: "rules",
    title: "Conversation AI offers no hints, criteria or rewind",
  },
  "rules.ca-confirm": { dim: "rules", title: "Ending the assessment asks first and returns focus" },
  "rules.ca-single-attempt": { dim: "rules", title: "The assessment cannot be retaken" },
  "rules.rp-run-cap": { dim: "rules", title: "Practice stops after five runs" },
  "rules.rung-with-score": { dim: "rules", title: "The claim rung is shown wherever a score is shown" },
  "rules.ratings-quoted": {
    dim: "rules",
    title: "Every observed rating shows the words it came from",
  },
  "rules.feedback-each-reply": { dim: "rules", title: "Practice gives feedback on every reply" },
  "rules.criteria-on-request": { dim: "rules", title: "Practice criteria appear on request" },
  "rules.hint-on-request": { dim: "rules", title: "Practice hints appear on request" },
  "rules.rewind": { dim: "rules", title: "Try again rewinds the last reply" },
  "rules.copy": { dim: "rules", title: "No em or en dashes, and skills is the word used" },
  "visual.no-overlap": { dim: "visual", title: "No overlapping text" },
  "visual.no-truncation": { dim: "visual", title: "No text cut off by ellipsis or clamp" },
  "visual.consistency": { dim: "visual", title: "One card radius, one control radius, product fonts only" },
  "visual.line-length": { dim: "visual", title: "Lines of text stay under 100 characters" },
  "visual.one-primary": {
    dim: "visual",
    title: "At most one primary action on home, brief and report screens",
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
const minutes = Math.round(scenario.durationSeconds / 60);
const MANIFEST: Record<string, string[]> = {
  "rp-home": [
    persona.name,
    persona.role,
    persona.organisation,
    player.challenge,
    player.scene,
    player.role,
    player.goal,
    ...objectives.flatMap((o) => [o.label, o.sub]),
    ...skills.flatMap((s) => [s.name, s.desc]),
    "Measured",
    "Firm but fair",
    "Hardball",
    "Impatient, sceptical",
    "Hint me when a reply misses",
    "Start run",
    "Your path",
    ...weeklyQuests([], new Date()).map((q) => q.label),
    ...BADGES.map((b) => b.name),
    "Daily goal",
    "Level",
    "Feedback status",
  ],
  "ca-brief": [
    player.scene,
    player.role,
    player.goal,
    player.challenge,
    ...objectives.flatMap((o) => [o.label, o.sub]),
    ...skills.flatMap((s) => [s.name, s.desc]),
    `Find a quiet place and allow the full ${minutes} minutes`,
    "Test your microphone and camera",
    "You have one attempt",
    "Extended time is available",
    "time limit",
    "One attempt",
    "Pass mark",
    "Pilot assessment, feedback only",
    persona.name,
    "Test microphone",
    "Test camera",
    "I have read the brief",
    "Begin the assessment",
  ],
  "rp-call": [
    player.goal,
    player.challenge,
    ...objectives.map((o) => o.label),
    "End Call",
    "Hold to talk",
    "Transcript",
    "XP",
    "badges",
    "Hint",
    "What counts",
  ],
  "ca-call": [
    player.role,
    player.goal,
    player.challenge,
    ...objectives.map((o) => o.label),
    "End Call",
    "Hold to talk",
    "Transcript",
    "Only your words are scored",
  ],
};

// Reports grow with the conversation, so the whole report must fit one frame only at the two main
// laptop sizes; everywhere else its summary must be in the first frame and the rest on the page.
const ONE_FRAME_REPORT = /laptop 1513x745|laptop 1440x800/;

// ---------------------------------------------------------------- combos
type Combo = {
  name: string;
  w: number;
  h: number;
  theme: "light" | "dark";
  frame: boolean; // laptop or tablet: one frame rules apply
  keyboard: boolean;
  reduced?: boolean;
  reflow?: boolean;
};
const COMBOS: Combo[] = [
  { name: "laptop 1513x745 light", w: 1513, h: 745, theme: "light", frame: true, keyboard: true },
  { name: "laptop 1513x745 dark", w: 1513, h: 745, theme: "dark", frame: true, keyboard: true },
  { name: "laptop 1440x800 light", w: 1440, h: 800, theme: "light", frame: true, keyboard: false },
  { name: "laptop 1280x720 light", w: 1280, h: 720, theme: "light", frame: true, keyboard: false },
  { name: "tablet 1180x820 light", w: 1180, h: 820, theme: "light", frame: true, keyboard: true },
  { name: "tablet 1180x820 dark", w: 1180, h: 820, theme: "dark", frame: true, keyboard: false },
  { name: "tablet 820x1180 light", w: 820, h: 1180, theme: "light", frame: true, keyboard: true },
  { name: "phone 390x844 light", w: 390, h: 844, theme: "light", frame: false, keyboard: true },
  { name: "phone 390x844 dark", w: 390, h: 844, theme: "dark", frame: false, keyboard: false },
  {
    name: "reflow 320x640 light",
    w: 320,
    h: 640,
    theme: "light",
    frame: false,
    keyboard: false,
    reflow: true,
  },
  {
    name: "laptop reduced motion",
    w: 1513,
    h: 745,
    theme: "light",
    frame: true,
    keyboard: false,
    reduced: true,
  },
];

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
  page.on("requestfailed", (r) => failed.push(`${r.url()} ${r.failure()?.errorText ?? ""}`));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  const t0 = Date.now();
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  const ready = Date.now() - t0;
  if (combo.name === "laptop 1513x745 light")
    check("flow.ready-fast", ready < 1500, `${path} ${combo.name}`, `${ready} ms`);
  if (combo.theme === "dark") await page.getByRole("button", { name: "Switch to dark theme" }).click();
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

async function waitYourTurn(page: Page) {
  await page.waitForTimeout(250);
  await page.waitForFunction(() => document.body.innerText.includes("Your turn"), undefined, {
    timeout: 20000,
  });
}
async function reply(c: Ctx, text: string) {
  await waitYourTurn(c.page);
  await c.page.locator("#composer").fill(text);
  const t0 = Date.now();
  await c.page.keyboard.press("Enter");
  await c.page.waitForFunction(() => /is thinking|is speaking/.test(document.body.innerText), undefined, {
    timeout: 5000,
  });
  const ack = Date.now() - t0;
  check("flow.reply-ack", ack < 400, c.combo.name, `${ack} ms`);
  await waitYourTurn(c.page);
  return Date.now() - t0;
}

// Measure one screen state.
async function audit(c: Ctx, state: string, kind: "player" | "report" | "overlay", manifest?: string[]) {
  const { page, combo } = c;
  const where = `${state} @ ${combo.name}`;
  await page.waitForTimeout(700); // let entrance animations settle
  if (process.env.EVAL_SHOTS) {
    const dir = join(ROOT, "eval", "results", "shots");
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, `${state} ${combo.name}.png`.replace(/\s+/g, "-")) });
  }
  if (combo.frame && kind !== "overlay") {
    const frame = await ev<string[]>(page, "window.__eval.frame()");
    const scroll = frame.filter((f) => /^(page|frame) scroll/.test(f));
    const clipped = frame.filter((f) => !/^(page|frame) scroll/.test(f));
    if (kind === "player") {
      checkList("frame.no-scroll", scroll, where);
      checkList("frame.no-clipped-panels", clipped, where);
    } else {
      checkList("frame.no-clipped-panels", clipped, where);
      if (ONE_FRAME_REPORT.test(combo.name)) checkList("frame.report-one-frame", scroll, where);
    }
    if (manifest) {
      const id = state.startsWith("rp-home")
        ? "info.home"
        : state.startsWith("ca-brief")
          ? "info.brief"
          : state.includes("call")
            ? "info.call"
            : "info.report";
      const viewport = kind === "player" || ONE_FRAME_REPORT.test(combo.name);
      checkList(id, await missing(page, manifest, viewport), where);
    }
    if (state.includes("call")) {
      const timer = await page
        .locator("text=/^\\d\\d:\\d\\d$/")
        .first()
        .isVisible()
        .catch(() => false);
      check("info.timer", timer, where, "no visible mm:ss timer");
    }
  }
  if (kind !== "overlay")
    checkList("frame.no-disclosure", await ev<string[]>(page, "window.__eval.disclosures()"), where);

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
  if (combo.reflow) {
    const side = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check("a11y.reflow", side <= 1, where, `${side}px sideways`);
  }

  // visual
  checkList("visual.no-overlap", await ev<string[]>(page, "window.__eval.overlaps()"), where);
  checkList("visual.no-truncation", await ev<string[]>(page, "window.__eval.truncated()"), where);
  checkList("visual.consistency", await ev<string[]>(page, "window.__eval.consistency()"), where);
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
  if (/\b\d{1,2}\s?\/\s?10\b/.test(text))
    check("rules.rung-with-score", /rung\s*\d/i.test(text), where, "score without rung");

  // keyboard
  if (combo.keyboard && kind !== "overlay") await keyboardWalk(c, where);
}

async function keyboardWalk(c: Ctx, where: string) {
  const { page } = c;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.click(2, 2).catch(() => {});
  const seen: string[] = [];
  const bad: string[] = [];
  let trapped = false;
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const f = await ev<{ body: boolean; id?: string; ring?: boolean; inView?: boolean }>(
      page,
      "window.__eval.focusInfo()",
    );
    if (f.body) break;
    if (!f.ring) bad.push(`${f.id} has no focus ring`);
    else if (!f.inView) bad.push(`${f.id} focused outside the view`);
    seen.push(f.id ?? "");
    if (i > 5 && seen.slice(-4).every((x) => x === seen[seen.length - 1])) {
      trapped = true;
      break;
    }
  }
  checkList("a11y.focus-visible", [...new Set(bad)], where);
  check("a11y.no-trap", !trapped, where, "focus stuck");
  await page.keyboard.press("Escape").catch(() => {});
}

// ---------------------------------------------------------------- journeys
async function practiceJourney(browser: Browser, combo: Combo) {
  const c = await open(browser, combo, "/");
  const { page } = c;
  const main = combo.name === "laptop 1513x745 light";
  await audit(c, "rp-home", "player", MANIFEST["rp-home"]);
  const start = page.getByRole("button", { name: /^Start run 1/ });
  const box = await start.boundingBox();
  check(
    "flow.start-one-click",
    !!box && box.y + box.height <= combo.h && (await start.isEnabled()),
    combo.name,
    "Start is not ready on screen",
  );
  await start.click();
  await waitYourTurn(page);
  await audit(c, "rp-call-start", "player", MANIFEST["rp-call"]);

  // A weak reply, then Try again rewinds it.
  await reply(c, "We can match their price.");
  if (main) {
    const youBefore = await page.locator('[role=log] li[data-speaker="you"]').count();
    const tryAgain = page.getByRole("button", { name: "Try again" });
    const offered = await tryAgain.isVisible().catch(() => false);
    if (offered) {
      await tryAgain.click();
      await page.waitForTimeout(500);
    }
    const youAfter = await page.locator('[role=log] li[data-speaker="you"]').count();
    check(
      "rules.rewind",
      offered && youAfter === youBefore - 1,
      combo.name,
      `offered ${offered}, ${youBefore} to ${youAfter}`,
    );
  }
  const t1 = await reply(c, "Before we talk price, what does your CFO need to see this year?");
  check("flow.feedback-fast", t1 < 8000, combo.name, `${t1} ms`);
  await reply(c, "What would switching cost your team in the first quarter?");
  const fb = await page.locator("[data-turn-feedback]").count();
  const yours = await page.locator('[role=log] li[data-speaker="you"]').count();
  const opening = scenario.stimulus.opening.filter((t) => t.speaker === "You").length;
  check(
    "rules.feedback-each-reply",
    fb === yours - opening && fb > 0,
    combo.name,
    `${fb} feedback for ${yours - opening} replies`,
  );

  // Criteria and hints on request.
  const before = await page.locator("text=What counts:").count();
  await page.getByRole("button", { name: /^What counts/ }).click();
  const after = await page.locator("text=What counts:").count();
  check(
    "rules.criteria-on-request",
    before === 0 && after === objectives.length,
    combo.name,
    `${before} then ${after}`,
  );
  await page.getByRole("button", { name: /^Hint/ }).click();
  const hint = await page
    .locator('[role=status]:has-text("Hint")')
    .first()
    .isVisible()
    .catch(() => false);
  check("rules.hint-on-request", hint, combo.name, "no hint shown");
  await audit(c, "rp-call-busy", "player", MANIFEST["rp-call"]);
  check(
    "flow.no-dead-ends",
    await page.getByRole("button", { name: "End Call" }).isVisible(),
    `rp-call ${combo.name}`,
    "no End Call",
  );

  // End, report, back home.
  await page.getByRole("button", { name: "End Call" }).click();
  await page.getByRole("button", { name: "Score now" }).click();
  await page.waitForSelector("#report-title", { timeout: 30000 });
  await reportChecks(c, "rp-report");
  const back = page.getByRole("button", { name: /Back to AI RolePlay|Practice home/ }).first();
  check(
    "flow.no-dead-ends",
    (await back.count()) > 0 && (await page.getByRole("button", { name: "Practise again" }).count()) > 0,
    `rp-report ${combo.name}`,
    "missing back or practise again",
  );
  await back.click();
  await page.waitForTimeout(400);
  await audit(c, "rp-home-after", "player", [
    ...MANIFEST["rp-home"].filter((x) => !x.startsWith("Start run")),
    "Start run 2",
    "Best",
  ]);
  await finish(c);
}

async function reportChecks(c: Ctx, state: string) {
  const { page } = c;
  const report = await page.evaluate(() => {
    const raw = localStorage.getItem("gk.roleplay.attempts.v2");
    const list = raw ? JSON.parse(raw) : [];
    return list[list.length - 1];
  });
  const items: string[] = ["Rung 1", "pass mark"];
  const quotes: string[] = [];
  for (const s of report.scores.skills) {
    items.push(s.name);
    for (const ind of s.indicators) {
      items.push(ind.label);
      for (const e of ind.evidence) quotes.push(e.quote.slice(0, 40));
    }
  }
  await audit(c, state, "report", items);
  const where = `${state} @ ${c.combo.name}`;
  checkList(
    "rules.ratings-quoted",
    await missing(page, [...new Set(quotes)], ONE_FRAME_REPORT.test(c.combo.name)),
    where,
  );
  if (c.combo.frame) {
    const summary = [
      "Pass mark",
      "Rung 1",
      state.startsWith("ca") ? "What happens next" : "Your next move",
      ...report.scores.skills.map((s: { name: string }) => s.name),
    ];
    checkList("frame.report-summary", await missing(page, summary, true), where);
  }
}

async function assessmentJourney(browser: Browser, combo: Combo) {
  const c = await open(browser, combo, "/assess/");
  const { page } = c;
  await audit(c, "ca-brief", "player", MANIFEST["ca-brief"]);
  const begin = page.getByRole("button", { name: "Begin the assessment" });
  const gated = !(await begin.isEnabled());
  await page.locator("#confirm-begin").check();
  check(
    "flow.begin-gated",
    gated && (await begin.isEnabled()),
    combo.name,
    "Begin is not gated by the confirmation",
  );
  await page.getByRole("button", { name: "Test microphone" }).click();
  await page.getByRole("button", { name: "Test camera" }).click();
  await page.waitForTimeout(800);
  await audit(
    c,
    "ca-brief-devices",
    "player",
    MANIFEST["ca-brief"].filter((x) => !x.startsWith("Test ")),
  );
  await begin.click();
  await waitYourTurn(page);
  await audit(c, "ca-call", "player", MANIFEST["ca-call"]);
  const tools = await page
    .getByRole("button", { name: /^(Hint|What counts|Rewind|Try again)|Retry from/ })
    .count();
  check("rules.ca-no-practice-tools", tools === 0, combo.name, `${tools} practice controls`);
  await reply(c, "Before we talk price, what does your CFO need to see this year?");
  await reply(c, "What would switching cost your team in the first quarter?");
  await audit(c, "ca-call-busy", "player", MANIFEST["ca-call"]);

  // End asks first; Escape keeps the call and returns focus.
  await page.getByRole("button", { name: "End Call" }).click();
  const dialog = page.getByRole("alertdialog", { name: "End the assessment?" });
  const shown = await dialog.isVisible();
  const focus1 = await page.evaluate(() => document.activeElement?.textContent ?? "");
  await audit(c, "ca-confirm", "overlay");
  await page.keyboard.press("Escape");
  const focus2 = await page.evaluate(() => document.activeElement?.textContent ?? "");
  check(
    "rules.ca-confirm",
    shown && focus1 === "Keep talking" && focus2 === "End Call",
    combo.name,
    `${shown} ${focus1} ${focus2}`,
  );
  await page.getByRole("button", { name: "End Call" }).click();
  await page.getByRole("button", { name: "End and score" }).click();
  await page.waitForSelector("#report-title", { timeout: 30000 });
  await reportChecks(c, "ca-report");
  const back = page.getByRole("button", { name: /Back to assessment|Assessment brief/ }).first();
  check("flow.no-dead-ends", (await back.count()) > 0, `ca-report ${combo.name}`, "no way back");
  await back.click();
  await page.waitForTimeout(400);
  await audit(c, "ca-brief-completed", "player", [
    "Assessment complete",
    "Open the report",
    player.scene,
    player.goal,
  ]);
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
    await page.getByRole("button", { name: new RegExp(`^Start run ${i}`) }).click();
    await waitYourTurn(page);
    await page.getByRole("button", { name: "End Call" }).click();
    await page.getByRole("button", { name: "Score now" }).click();
    await page.waitForSelector("#report-title", { timeout: 30000 });
    await page
      .getByRole("button", { name: /Back to AI RolePlay|Practice home/ })
      .first()
      .click();
    await page.waitForTimeout(300);
  }
  const used = page.getByRole("button", { name: `All ${scenario.maxPracticeAttempts} runs used` });
  check(
    "rules.rp-run-cap",
    (await used.count()) > 0 && !(await used.first().isEnabled()),
    combo.name,
    "start still available",
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

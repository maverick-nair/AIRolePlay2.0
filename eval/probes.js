// In-page measurements for the product eval. Injected into every page as window.__eval, so the
// runner can call them by name. Plain browser JavaScript: no imports, no build step.
(() => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const inViewport = (r) =>
    r.width > 1 &&
    r.height > 1 &&
    r.top >= -1 &&
    r.left >= -1 &&
    r.bottom <= innerHeight + 1 &&
    r.right <= innerWidth + 1;
  const isSrOnly = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return true;
      if (cs.position === "absolute" && e.getBoundingClientRect().width <= 1) return true;
      if (cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)") return true;
    }
    return false;
  };
  const visible = (el) => {
    if (!el || isSrOnly(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const inScrollLog = (el) => !!el.closest("[data-scroll-log] [role=log]");

  // Performance observers: layout shift, largest paint, long tasks.
  // CLS follows the Web Vitals definition: shifts are grouped into session windows (a gap under 1 s,
  // a window under 5 s) and the score is the largest window. The worst shift's source is kept for the log.
  window.__perf = { cls: 0, lcp: 0, longTasks: [], worst: "" };
  let win = { sum: 0, start: 0, last: 0 };
  let worst = 0;
  const describe = (n) =>
    n && n.nodeType === 1
      ? `${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""} "${(n.textContent || "").trim().slice(0, 30)}"`
      : "text";
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        const t = e.startTime;
        if (win.sum && (t - win.last >= 1000 || t - win.start >= 5000)) win = { sum: 0, start: t, last: t };
        if (!win.sum) win.start = t;
        win.sum += e.value;
        win.last = t;
        window.__perf.cls = Math.max(window.__perf.cls, win.sum);
        if (e.value > worst) {
          worst = e.value;
          const src = (e.sources || [])[0];
          window.__perf.worst = `${e.value.toFixed(3)} at ${Math.round(t)} ms, ${describe(src && src.node)}`;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.longTasks.push(Math.round(e.duration));
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* observers are best effort */
  }

  const api = {
    // One frame: nothing scrolls, nothing is clipped, nothing is folded away.
    frame() {
      const out = [];
      const de = document.documentElement;
      if (de.scrollHeight > innerHeight + 1) out.push(`page scrolls ${de.scrollHeight - innerHeight}px`);
      if (de.scrollWidth > innerWidth + 1) out.push(`page scrolls sideways ${de.scrollWidth - innerWidth}px`);
      const content = document.querySelector("nav + div");
      if (content && content.scrollHeight > content.clientHeight + 1)
        out.push(`frame scrolls ${content.scrollHeight - content.clientHeight}px`);
      document.querySelectorAll(".card").forEach((c) => {
        if (!visible(c)) return;
        const over = c.scrollHeight - c.clientHeight;
        const name = norm(
          c.querySelector("h1,h2,h3")?.textContent || c.getAttribute("aria-label") || "",
        ).slice(0, 40);
        if (over > 1) out.push(`panel "${name}" overflows ${over}px`);
      });
      // Content hidden inside an inner scroll area (the live transcript is the one allowed exception).
      document.querySelectorAll("body *").forEach((el) => {
        if (!visible(el) || el.matches("[role=log]") || el === content) return;
        const cs = getComputedStyle(el);
        if (!/(auto|scroll)/.test(cs.overflowY)) return;
        const over = el.scrollHeight - el.clientHeight;
        if (over > 1) out.push(`inner scroll hides ${over}px of "${norm(el.textContent).slice(0, 30)}"`);
      });
      const stage = document.querySelector('main[aria-label="Conversation"] > div');
      if (stage && stage.scrollHeight > stage.clientHeight + 1)
        out.push(`stage clipped ${stage.scrollHeight - stage.clientHeight}px`);
      return out;
    },
    // Disclosure patterns that hide information behind a click.
    disclosures() {
      const out = [];
      if (document.querySelector("details")) out.push("accordion (details)");
      if (document.querySelector('[role="tablist"],[role="tab"]')) out.push("tabs");
      document.querySelectorAll('[aria-expanded="false"]').forEach((el) => {
        if (el.closest("[data-eval-action-menu]")) return;
        out.push(`collapsed control "${norm(el.textContent).slice(0, 30)}"`);
      });
      if (document.querySelector('[aria-roledescription="carousel"]')) out.push("carousel");
      return out;
    },
    // Is each text snippet on screen: in the viewport, not hidden, not covered, not only in a scroll log?
    missing(items, opts) {
      const needView = !opts || opts.viewport !== false;
      const els = [...document.querySelectorAll("body *")].filter(
        (e) => !["SCRIPT", "STYLE", "SVG", "PATH"].includes(e.tagName.toUpperCase()),
      );
      const out = [];
      for (const raw of items) {
        const want = norm(raw).slice(0, 48).toLowerCase();
        let best = null;
        for (const e of els) {
          const t = norm(e.textContent).toLowerCase();
          if (!t.includes(want)) continue;
          if (!best || t.length < norm(best.textContent).length) best = e;
        }
        if (!best) {
          out.push(`${raw.slice(0, 50)}: not on the page`);
          continue;
        }
        // All matching smallest elements: pass if any one is visible.
        const cands = els.filter(
          (e) =>
            norm(e.textContent).toLowerCase().includes(want) &&
            ![...e.children].some((c) => norm(c.textContent).toLowerCase().includes(want)),
        );
        let ok = false;
        let why = "hidden";
        for (const c of cands) {
          if (!visible(c)) continue;
          if (inScrollLog(c)) {
            why = "only in the scrolling transcript";
            continue;
          }
          const r = c.getBoundingClientRect();
          if (!needView) {
            ok = true;
            break;
          }
          if (!inViewport(r)) {
            why = "outside the viewport";
            continue;
          }
          // Hit test the first line of the text itself, not the box around it.
          const range = document.createRange();
          range.selectNodeContents(c);
          const line = [...range.getClientRects()].find((q) => q.width > 1 && q.height > 1) || r;
          const hit = document.elementFromPoint(
            line.left + Math.min(line.width / 2, 12),
            line.top + line.height / 2,
          );
          if (hit && (c.contains(hit) || hit.contains(c))) {
            ok = true;
            break;
          }
          why = "covered by another element";
        }
        if (!ok) out.push(`${raw.slice(0, 50)}: ${why}`);
      }
      return out;
    },
    // Visible text below 12px.
    smallText() {
      const out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!norm(n.textContent)) continue;
        const el = n.parentElement;
        if (!el || !visible(el)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) out.push(`${fs}px "${norm(n.textContent).slice(0, 30)}"`);
      }
      return [...new Set(out)];
    },
    // Targets smaller than 24 by 24 px without the spacing exception (WCAG 2.5.8).
    smallTargets() {
      const sel =
        'button,a[href],input,select,textarea,summary,[role="button"],[role="tab"],[role="radio"],[role="checkbox"]';
      const targets = [...document.querySelectorAll(sel)]
        .filter(visible)
        .map((el) => ({ el, r: el.getBoundingClientRect() }));
      const out = [];
      for (const { el, r } of targets) {
        if (r.width >= 24 && r.height >= 24) continue;
        if (el.tagName === "A" && el.closest("p")) continue; // inline link in a sentence
        const cx = r.left + r.width / 2,
          cy = r.top + r.height / 2;
        const clash = targets.some(({ el: o, r: q }) => {
          if (o === el || o.contains(el) || el.contains(o)) return false;
          const dx = Math.max(q.left - cx, 0, cx - q.right),
            dy = Math.max(q.top - cy, 0, cy - q.bottom);
          return Math.hypot(dx, dy) < 12;
        });
        if (clash)
          out.push(
            `${Math.round(r.width)}x${Math.round(r.height)} ${el.tagName.toLowerCase()} "${norm(el.getAttribute("aria-label") || el.textContent).slice(0, 30)}"`,
          );
      }
      return out;
    },
    // Infinite animations still running (checked with reduced motion requested).
    endlessMotion() {
      return document
        .getAnimations()
        .filter((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity)
        .filter((a) => a.effect?.target && visible(a.effect.target))
        .map(
          (a) =>
            `${a.animationName || "animation"} on ${a.effect.target.tagName.toLowerCase()}.${String(a.effect.target.className).split(" ")[0]}`,
        );
    },
    // The focused element: does it show a visible focus indicator and sit in the viewport?
    focusInfo() {
      const el = document.activeElement;
      if (!el || el === document.body) return { body: true };
      const cs = getComputedStyle(el);
      const ring =
        (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) ||
        (cs.boxShadow && cs.boxShadow !== "none");
      const r = el.getBoundingClientRect();
      return {
        body: false,
        id: `${el.tagName.toLowerCase()} "${norm(el.getAttribute("aria-label") || el.textContent).slice(0, 30)}"`,
        ring: !!ring,
        inView: inViewport(r) || !!el.closest("[role=log]"),
      };
    },
    // Text elements that overlap each other. Text hidden under an opaque panel (a sticky bar, a card
    // on top) is covered, not overlapping, so it is not counted.
    overlaps() {
      const opaque = (el) => {
        const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
        if (!m) return false;
        const parts = m[1].split(",").map((x) => parseFloat(x));
        return parts.length < 4 || parts[3] >= 0.95;
      };
      const occluded = (A, B, ra, rb) => {
        const x = (Math.max(ra.left, rb.left) + Math.min(ra.right, rb.right)) / 2;
        const y = (Math.max(ra.top, rb.top) + Math.min(ra.bottom, rb.bottom)) / 2;
        const top = document.elementFromPoint(x, y);
        if (!top) return false;
        const pa = A.n.parentElement,
          pb = B.n.parentElement;
        const lower =
          pa.contains(top) || top.contains(pa) ? pb : pb.contains(top) || top.contains(pb) ? pa : null;
        if (!lower) return true; // neither text is painted here: both sit under another layer
        for (let e = top; e && !e.contains(lower); e = e.parentElement) if (opaque(e)) return true;
        return false;
      };
      const boxes = [];
      // While a modal dialog is open, the page behind it is inert and dimmed: measure the dialog only.
      const modal = [...document.querySelectorAll('[aria-modal="true"]')].find(visible);
      const w = document.createTreeWalker(modal || document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!norm(n.textContent) || !n.parentElement || !visible(n.parentElement)) continue;
        if (n.parentElement.closest("[aria-hidden=true],[role=log],svg")) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (r.width > 2 && r.height > 2) boxes.push({ n, r });
      }
      const out = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r,
            b = boxes[j].r;
          if (boxes[i].n === boxes[j].n) continue;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 2 && oy > 3 && !occluded(boxes[i], boxes[j], a, b))
            out.push(
              `"${norm(boxes[i].n.textContent).slice(0, 20)}" overlaps "${norm(boxes[j].n.textContent).slice(0, 20)}"`,
            );
        }
      return [...new Set(out)].slice(0, 10);
    },
    // Text cut off by an ellipsis, a clamp or a hidden overflow.
    truncated() {
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (!visible(el) || !norm(el.textContent) || el.closest("[role=log]")) continue;
        const cs = getComputedStyle(el);
        const clipsX =
          cs.textOverflow === "ellipsis" || (cs.overflowX === "hidden" && cs.whiteSpace === "nowrap");
        if (clipsX && el.scrollWidth > el.clientWidth + 1)
          out.push(`"${norm(el.textContent).slice(0, 30)}" cut off`);
        if (cs.webkitLineClamp && cs.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1)
          out.push(`"${norm(el.textContent).slice(0, 30)}" clamped`);
      }
      return out;
    },
    // Design consistency: one card radius, one control radius, product fonts only.
    consistency() {
      const out = [];
      const radii = (sel) =>
        new Set(
          [...document.querySelectorAll(sel)]
            .filter(visible)
            .map((e) => getComputedStyle(e).borderTopLeftRadius),
        );
      const cards = radii(".card");
      if (cards.size > 1) out.push(`cards use ${cards.size} radii: ${[...cards].join(", ")}`);
      const btns = radii(".btn:not(.rounded-full)");
      if (btns.size > 1) out.push(`buttons use ${btns.size} radii: ${[...btns].join(", ")}`);
      const fams = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!norm(n.textContent) || !n.parentElement || !visible(n.parentElement)) continue;
        fams.add(getComputedStyle(n.parentElement).fontFamily.split(",")[0].replace(/"/g, "").trim());
      }
      const allowed = /^(Figtree Variable|IBM Plex Sans Variable|IBM Plex Mono)$/;
      for (const f of fams) if (!allowed.test(f)) out.push(`font "${f}" in use`);
      return out;
    },
    // Paragraph lines longer than 100 characters are hard to read.
    longLines() {
      const out = [];
      for (const p of document.querySelectorAll("p, li, blockquote")) {
        if (!visible(p) || p.closest("[role=log]")) continue;
        const text = norm(p.textContent);
        if (text.length < 120) continue;
        const range = document.createRange();
        range.selectNodeContents(p);
        const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top / 4)));
        const cpl = text.length / Math.max(1, tops.size);
        if (cpl > 100) out.push(`${Math.round(cpl)} characters a line: "${text.slice(0, 30)}"`);
      }
      return out;
    },
    // Visible, enabled primary buttons.
    primaries() {
      return [...document.querySelectorAll(".btn-primary")]
        .filter((b) => visible(b) && !b.disabled)
        .map((b) => norm(b.textContent).slice(0, 30));
    },
    text() {
      return document.body.innerText;
    },
    perf() {
      return window.__perf;
    },
    counts() {
      return {
        h1: [...document.querySelectorAll("h1")].filter((h) => !isSrOnly(h) || true).length,
        main: document.querySelectorAll("main,[role=main]").length,
        nav: document.querySelectorAll("nav").length,
      };
    },
  };
  window.__eval = api;
})();

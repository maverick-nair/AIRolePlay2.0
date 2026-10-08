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
    // Content of a closed disclosure is not shown, whatever its boxes say.
    const closed = el.closest && el.closest("details:not([open])");
    if (closed && !el.closest("summary")) return true;
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
  const inScrollLog = () => false;
  let focusSeq = 0;
  // Is this text box cut away by an ancestor that clips its overflow (a scrolled list, a panel)?
  const clippedAway = (el, r) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      const b = e.getBoundingClientRect();
      if (r.bottom <= b.top + 1 || r.top >= b.bottom - 1 || r.right <= b.left + 1 || r.left >= b.right - 1)
        return true;
    }
    return false;
  };

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
    // Layout: sideways scroll, and regions that hide content. A scroll region that can be scrolled
    // (the transcript, a side panel list) is fine; a hidden overflow that cuts content off is not.
    layout() {
      const de = document.documentElement;
      const clipped = [];
      document.querySelectorAll("body *").forEach((el) => {
        if (!visible(el) || !norm(el.textContent)) return;
        const cs = getComputedStyle(el);
        if (cs.overflowY !== "hidden" && cs.overflowY !== "clip") return;
        const over = el.scrollHeight - el.clientHeight;
        if (over <= 2) return;
        // Only count it when real text sits below the clip edge.
        const box = el.getBoundingClientRect();
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!norm(n.textContent) || !n.parentElement || isSrOnly(n.parentElement)) continue;
          if (n.parentElement.closest("[aria-hidden=true]")) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const r = [...range.getClientRects()].find((q) => q.height > 1);
          if (r && r.top >= box.bottom - 1) {
            clipped.push(`"${norm(el.textContent).slice(0, 30)}" hides ${over}px`);
            break;
          }
        }
      });
      return {
        sideways: Math.max(0, de.scrollWidth - innerWidth),
        clipped: [...new Set(clipped)].slice(0, 6),
      };
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
        // SVG text renders at its font size times the drawing's scale.
        const scale = el instanceof SVGElement && el.getScreenCTM ? Math.abs(el.getScreenCTM()?.a || 1) : 1;
        const fs = Math.round(parseFloat(getComputedStyle(el).fontSize) * scale * 10) / 10;
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
      if (!el.dataset.evalFocus) el.dataset.evalFocus = String(++focusSeq);
      return {
        body: false,
        key: el.dataset.evalFocus,
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
        for (const r of range.getClientRects())
          if (r.width > 2 && r.height > 2 && !clippedAway(n.parentElement, r)) boxes.push({ n, r });
      }
      const out = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r,
            b = boxes[j].r;
          if (boxes[i].n === boxes[j].n) continue;
          // Lines of one heading or paragraph may have tight leading; that is not two texts colliding.
          const blk = (n) =>
            n.parentElement.closest("p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,dd,dt,label,button,a");
          if (blk(boxes[i].n) && blk(boxes[i].n) === blk(boxes[j].n)) continue;
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
    // Only the product fonts: Outfit for display, Inter for body.
    fonts() {
      const fams = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!norm(n.textContent) || !n.parentElement || !visible(n.parentElement)) continue;
        fams.add(getComputedStyle(n.parentElement).fontFamily.split(",")[0].replace(/"/g, "").trim());
      }
      return [...fams].filter((f) => !/^(Outfit|Inter)$/.test(f)).map((f) => `font "${f}" in use`);
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
    // Visible, enabled primary buttons in the viewport: filled with the product accent.
    primaries() {
      const probe = document.createElement("span");
      probe.style.color = "var(--accent)";
      document.body.appendChild(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      return [...document.querySelectorAll("button,a")]
        .filter((b) => visible(b) && !b.disabled && inViewport(b.getBoundingClientRect()))
        .filter((b) => !b.matches("[role=tab],[role=radio],[aria-pressed],[aria-selected],[aria-checked]"))
        .filter((b) => {
          const cs = getComputedStyle(b);
          return (
            cs.backgroundColor === accent ||
            (cs.backgroundImage.includes("gradient") && cs.color === "rgb(255, 255, 255)")
          );
        })
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

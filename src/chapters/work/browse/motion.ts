/**
 * Browse chapter motion — the paging (dwell/advance) and the first-load
 * reveal. Implements story-19.7's sliding-window model: each row occupies
 * one of four positions (REST / PEEK / OFF-TOP / OFF-BOTTOM) as a function
 * of how many pages the user has scrolled past it — see
 * docs/epics/epic-19-portfolio-browse.md Step 7 for the full model and why
 * a single rigid-column translate can't satisfy "top-third rest" + "visible
 * peek" + "no-trace exit" simultaneously.
 *
 * Positions mix a proportional value (dwellTop × viewport height) with
 * fixed-px values (cardHeight, peek) — unlike the timeline chapter, they
 * can't all ride plain CSS vh units for free, so in principle this should
 * measure the viewport and recompute on resize (the octagon.ts pattern).
 *
 * KNOWN GAP, flagged rather than hidden: a live, in-place recompute of the
 * row positions on resize is NOT implemented. Two approaches were tried —
 * tl.invalidate() + re-render, and a full tl.clear()-and-rebuild — and both
 * produced demonstrably wrong output (a tween whose segment had already
 * played resolved to neither its old nor its new value; the rebuild in one
 * case shifted targets across rows). Diagnosing the exact GSAP-internals
 * cause was disproportionate to this story's scope, so rather than ship a
 * subtly-broken "fix," positions are simply computed once at chapter build
 * time (page load / SPA navigation) and stay pinned to that V until the
 * next one. Only ScrollTrigger.refresh() runs on resize, which correctly
 * recalculates the page-level scroll-to-progress mapping (engine.ts's own
 * vhToPx is a function for the same reason) — a real fix, just a partial
 * one. Revisit if this ever matters in practice.
 *
 * Paging (this file's returned, scrubbed timeline) and the reveal (a
 * separate, autoplay timeline) are kept on different elements — the outer
 * .browse-row carries paging's translateY, the inner .browse-row-inner
 * carries the reveal's opacity/rise — mirroring the .tl-card-anchor
 * wrapper/figure split in global.css, which documents the exact failure
 * mode (GSAP fighting a second transform on the same element) this avoids.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ChapterMotion } from "@motion/engine";
import { browse, advancePhaseLength } from "@config/browse";

gsap.registerPlugin(ScrollTrigger);

/** Clearance past cardHeight so an exiting row leaves with no visible sliver. */
const OFF_TOP_CLEARANCE = browse.rowGutter;
const RESIZE_DEBOUNCE_MS = 100;

// Repeat SPA visits to /work call beats() fresh each time (see page-init.ts),
// so a plain addEventListener would accumulate one listener per visit —
// same class of footgun engine.ts's own ScrollTrigger.getAll().forEach(kill)
// guards against for triggers. Track and remove the previous one first.
let currentResizeHandler: (() => void) | null = null;

const motion: ChapterMotion = {
  beats(container) {
    const tl = gsap.timeline();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Do nothing else: rows stay in their default static/flow classes
      // (the full-motion Tailwind utilities below never get added), so
      // Content.astro's capped-height, internally-scrollable column is
      // what's reachable — every project, no paging, no autoplay reveal.
      // Mirrors the About chapter's own
      // reduced-motion check (see its motion.ts) rather than relying on
      // the engine's generic tl.progress(1) path, which would jump this
      // pager straight to its last page and strand every row before it.
      //
      // Rows 0/1 DO need one explicit unhide, though: Content.astro gives
      // their .browse-row-inner a static opacity-0 (FOUC prevention for the
      // full-motion reveal below) — under reduced motion nothing else ever
      // sets it back, so left alone those two rows would stay permanently
      // invisible.
      gsap.set(container.querySelectorAll(".browse-row-inner"), {
        opacity: 1,
      });
      return tl;
    }

    const column = container.querySelector<HTMLElement>(
      "[data-el='browse-column']",
    );
    const rowEls = Array.from(
      container.querySelectorAll<HTMLElement>(".browse-row"),
    );
    if (!column || rowEls.length === 0) {
      console.warn("browse/motion: no rows found — empty timeline.");
      return tl;
    }

    // Full-motion layout switch — plain Tailwind utilities, not a custom
    // class (CLAUDE.md: Tailwind-first, no bespoke layout classes). The
    // column's default/reduced-motion classes (overflow-y-auto,
    // .browse-max-h) come off; the paging surface goes on. Each row moves
    // from normal flow (space-y-* on the column supplies its gutter) to
    // absolute, so motion below can drive its own translateY independently.
    column.classList.remove("overflow-y-auto", "browse-max-h");
    column.classList.add("relative", "overflow-visible", "w-screen", "h-dvh");
    rowEls.forEach((row) => {
      row.classList.add("absolute", "top-0", "left-0", "right-0", "mt-0");
    });

    const rows = rowEls.length;

    // ── Measurement — see the header comment on why this isn't recomputed
    // live on resize. restY is measured from the mat's own visible top/
    // bottom (--mat-safe-inset-top/bottom), not the raw viewport — "top
    // third" means top third of the visible mat, not the whole window,
    // which includes the logo/nav headroom the mat itself keeps clear.
    // Parsed directly since both tokens are plain px today; if either ever
    // becomes a clamp() value this needs octagon.ts's probe-element
    // technique instead (parseFloat can't resolve clamp()). ──
    const V = window.innerHeight;
    const rootStyle = getComputedStyle(document.documentElement);
    function readPx(varName: string, fallback: number): number {
      const parsed = parseFloat(rootStyle.getPropertyValue(varName));
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    const matInsetTop = readPx("--mat-safe-inset-top", 60);
    const matInsetBottom = readPx("--mat-safe-inset-bottom", 50);

    const restY = () =>
      matInsetTop + browse.dwellTop * (V - matInsetTop - matInsetBottom);
    const peekY = () => V - browse.peek;
    const offTopY = () => -(browse.cardHeight + OFF_TOP_CLEARANCE);
    const offBottomY = () => V;

    // Peek guard (borrows octagon.ts's init-time invariant-check idea): if
    // the resting row's own bottom edge reaches past where the peek row's
    // top sits, the peek row is partly hidden behind it — warn instead of
    // silently showing a smaller (or zero) peek. Checked once at init only,
    // same as octagon's own guard — not re-checked on resize.
    function checkPeekGuard(): void {
      const availableBelowRest = V - (restY() + browse.cardHeight);
      const actualPeek = Math.min(browse.peek, Math.max(0, availableBelowRest));
      if (actualPeek < browse.peek) {
        console.warn(
          `[browse] dwellTop (${browse.dwellTop}) + cardHeight (${browse.cardHeight}px) ` +
            `leaves only ${Math.round(actualPeek)}px of peek at this viewport height ` +
            `(configured peek: ${browse.peek}px) — the resting row overlaps the peeking ` +
            `row. Lower dwellTop, cardHeight, or peek.`,
        );
      }
    }
    checkPeekGuard();

    /** This row's position at initial load (page 0): row 0 rests, row 1
     * peeks, everything else is staged below the fold. */
    function initialYFor(r: number) {
      return () => (r === 0 ? restY() : r === 1 ? peekY() : offBottomY());
    }

    // Every tween is .fromTo() with BOTH ends as explicit functions of V,
    // never .to()/.set() alone reading a live DOM value — keeps every
    // row's position a pure function of config + the V captured above.
    rowEls.forEach((row, r) => {
      const initial = initialYFor(r);
      tl.fromTo(row, { y: initial }, { y: initial, duration: 0 }, 0);
    });

    // One advance (page k → k+1) moves exactly three rows, but NOT as one
    // shared window: the active row's own exit (accelerating, matching the
    // site's paper fly-away ease) starts the instant the advance begins;
    // the next row's entrance (decelerating into rest) and the row after
    // that (rising to its own peek) don't start until enterDelayBeats after
    // that — set close to exitBeats, the exiting row is nearly gone before
    // anything else moves, with no overlap. advancePhaseLength() (shared
    // with work.script.ts's derived total, so the two can't drift apart)
    // is long enough to cover whichever of the two phases finishes later.
    const phaseLength = advancePhaseLength();
    for (let k = 0; k < rows - 1; k++) {
      const exitStart = (k + 1) * browse.dwellBeats + k * phaseLength;
      const enterStart = exitStart + browse.enterDelayBeats;
      tl.fromTo(
        rowEls[k],
        { y: restY },
        { y: offTopY, duration: browse.exitBeats, ease: browse.exitEase },
        exitStart,
      );
      tl.fromTo(
        rowEls[k + 1],
        { y: peekY },
        { y: restY, duration: browse.enterBeats, ease: browse.enterEase },
        enterStart,
      );
      if (k + 2 <= rows - 1) {
        tl.fromTo(
          rowEls[k + 2],
          { y: offBottomY },
          { y: peekY, duration: browse.enterBeats, ease: browse.enterEase },
          enterStart,
        );
      }
    }

    // First-load reveal — autoplay (real time, not scrubbed), on rows 0/1
    // only (the ones visible without any scrolling), each its OWN tween
    // rather than one shared one — row 1 starts reveal.rowStaggerBeats
    // after row 0, so the two don't appear simultaneously. browse.reveal's
    // fields are seconds here since this timeline runs on GSAP's own clock,
    // not the scroll scrub; reuses enterEase (this is a row "arriving," the
    // same as a paging entrance) rather than a third ease knob.
    const revealInners = rowEls
      .slice(0, 2)
      .map((row) => row.querySelector<HTMLElement>(".browse-row-inner"))
      .filter((el): el is HTMLElement => el !== null);
    revealInners.forEach((inner, i) => {
      gsap.set(inner, { opacity: 0, y: browse.reveal.rise });
      gsap.to(inner, {
        opacity: 1,
        y: 0,
        duration: browse.reveal.overBeats,
        delay: browse.reveal.delayBeats + i * browse.reveal.rowStaggerBeats,
        ease: browse.enterEase,
      });
    });

    // ── Resize: row positions stay pinned to the V measured at build time
    // (see the header comment's KNOWN GAP) — only ScrollTrigger's own
    // scroll-to-progress mapping recalculates, which is still a real,
    // worthwhile fix on its own. ──
    if (currentResizeHandler) {
      window.removeEventListener("resize", currentResizeHandler);
    }
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    currentResizeHandler = () => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        ScrollTrigger.refresh();
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", currentResizeHandler);

    return tl;
  },
};

export default motion;

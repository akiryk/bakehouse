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
 * measure the viewport and recompute on resize (the components/stage/motion-script.ts pattern).
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
 * recalculates the page-level scroll-to-progress mapping (components/scroll-engine/motion-script.ts's own
 * vhToPx is a function for the same reason) — a real fix, just a partial
 * one. Revisit if this ever matters in practice.
 *
 * Paging, the reveal, and the per-card exit are kept on three different
 * elements, never stacking two GSAP-driven transforms on the same one —
 * the .tl-card-anchor wrapper/figure split in global.css documents the
 * exact failure mode (GSAP fighting a second transform on the same
 * element) this avoids:
 *   - .browse-row carries entrance translateY (PEEK -> REST, OFF-BOTTOM ->
 *     PEEK) and stays PINNED at REST once it arrives — it never itself
 *     animates the exit.
 *   - Each card (.browse-row-inner > article) carries its OWN nested exit
 *     translateY, a delta relative to the row's pinned position, so 3 cards
 *     in one row can leave independently instead of as one rigid unit. Each
 *     card ALSO carries a static translateX, set once and never animated —
 *     a fixed per-card personality that breaks the grid's strict column
 *     alignment, composed on the same element as the exit's translateY
 *     with no conflict (GSAP tracks x/y as independent sub-properties of
 *     one transform, unlike two things fighting over the SAME axis).
 *   - .browse-row-inner carries the first-load reveal's opacity/rise.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ChapterMotion } from "@components/scroll-engine/motion-script";
import { browse, advancePhaseLength } from "../../config";

gsap.registerPlugin(ScrollTrigger);

/** Clearance past cardHeight so an exiting row leaves with no visible sliver. */
const OFF_TOP_CLEARANCE = browse.rowGutter;
const RESIZE_DEBOUNCE_MS = 100;

// Repeat SPA visits to /work call beats() fresh each time (see global-scripts/page-init.ts),
// so a plain addEventListener would accumulate one listener per visit —
// same class of footgun components/scroll-engine/motion-script.ts's own ScrollTrigger.getAll().forEach(kill)
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
    // becomes a clamp() value this needs components/stage/motion-script.ts's probe-element
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

    // Peek guard (borrows components/stage/motion-script.ts's init-time invariant-check idea): if
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

    // Fisher-Yates — a fresh copy, doesn't mutate the input. Rolled once per
    // row per chapter build (page load / SPA navigation), not per scroll
    // frame, so one viewing always replays the same sequence forward and
    // backward — re-rolling mid-scrub would mean the row looks different
    // each time you pass through it, which reads as broken, not organic.
    function shuffled<T>(arr: T[]): T[] {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    /** Symmetric random offset in [-amount, +amount]. */
    function jitter(amount: number): number {
      return (Math.random() * 2 - 1) * amount;
    }

    // Scatter guard (same idea as the peek guard above): if
    // cardScatterRange exceeds half of cardScatterGutter, two neighbors
    // jittering straight at each other CAN overlap — warn instead of
    // silently letting it happen. Checked once at init only.
    if (browse.cardScatterRange > browse.cardScatterGutter / 2) {
      console.warn(
        `[browse] cardScatterRange (${browse.cardScatterRange}px) exceeds half of ` +
          `cardScatterGutter (${browse.cardScatterGutter}px) — two adjacent cards ` +
          `jittering toward each other could overlap. Keep cardScatterRange <= ` +
          `cardScatterGutter / 2.`,
      );
    }

    // Static per-card horizontal jitter — breaks the grid's strict column
    // alignment. Not part of the scrubbed timeline at all (it never
    // changes with scroll), so a plain immediate gsap.set(), same as the
    // reveal's own initial-hidden-state sets below. Every row gets this,
    // including the last one (which never exits) — this is a permanent
    // visual trait of the card, not tied to the paging motion.
    //
    // Each card jitters independently around a REFERENCE grid position
    // (cardScatterGutter, wider than the real colGutter) rather than its
    // own real CSS-grid position — baseShift(i) is the constant distance
    // between the two for column i, computed once; the random part is
    // added on top, per card, per row. See browse.ts's own comment for why
    // this keeps "no overlap" a guarantee rather than a hope, and for the
    // guard above. A final corrective shift, applied per row, catches the
    // (now much rarer, since the range here is small) case where the row's
    // outer edge would land off the visible stage — a uniform shift
    // preserves every card's relative position, it just relocates the row.
    const stageWidth = window.innerWidth;
    const naturalRowWidth =
      browse.columns * browse.cardWidth +
      (browse.columns - 1) * browse.colGutter;
    const centeringMargin = (stageWidth - naturalRowWidth) / 2;
    const center = (browse.columns - 1) / 2;
    function baseShift(i: number): number {
      return (i - center) * (browse.cardScatterGutter - browse.colGutter);
    }

    rowEls.forEach((row) => {
      const cards = Array.from(
        row.querySelectorAll<HTMLElement>(".browse-row-inner > article"),
      );
      if (cards.length === 0) return;

      const offsets = cards.map(
        (_, i) => baseShift(i) + jitter(browse.cardScatterRange),
      );

      const leftEdge = centeringMargin + offsets[0];
      const rightEdge =
        stageWidth - centeringMargin + offsets[offsets.length - 1];
      let shift = 0;
      if (leftEdge < 0) shift = -leftEdge;
      else if (rightEdge > stageWidth) shift = stageWidth - rightEdge;

      cards.forEach((card, i) => {
        gsap.set(card, { x: offsets[i] + shift });
      });
    });

    // Every card ends up at the same absolute Y (offTopY) regardless of
    // which row it's in, but each card's OWN transform is relative to its
    // row's pinned position (see the header comment) — so what a card
    // actually tweens is the DELTA from rest to off-top, not the absolute
    // value itself.
    const exitDelta = () => offTopY() - restY();

    // One advance (page k → k+1) moves exactly three rows, but NOT as one
    // shared window: the active row's cards each start their own exit
    // (accelerating, matching the site's paper fly-away ease) in a random
    // per-row order, at jittered — not perfectly even — intervals, all
    // starting the instant the advance begins ("peeling off," not a
    // synchronized block). The next row's entrance (decelerating into
    // rest) and the row after that (rising to its own peek) — still one
    // synchronized row-level move each, arriving together — don't start
    // until enterDelayBeats after that, timed against the worst-case last
    // card's finish (see advancePhaseLength()), so the exiting row is
    // nearly gone before anything else moves, with no overlap.
    // advancePhaseLength() (shared with work-browse/motion-script.ts's derived total, so
    // the two can't drift apart) is long enough to cover whichever of the
    // two phases finishes later.
    const phaseLength = advancePhaseLength();
    for (let k = 0; k < rows - 1; k++) {
      const exitStart = (k + 1) * browse.dwellBeats + k * phaseLength;
      const enterStart = exitStart + browse.enterDelayBeats;

      const cards = Array.from(
        rowEls[k].querySelectorAll<HTMLElement>(".browse-row-inner > article"),
      );
      tl.fromTo(cards, { y: 0 }, { y: 0, duration: 0 }, 0);
      const order = shuffled(cards.map((_, i) => i));
      order.forEach((cardIndex, position) => {
        const delay = Math.max(
          0,
          position * browse.cardExitStaggerBeats +
            jitter(browse.cardExitJitterBeats),
        );
        tl.fromTo(
          cards[cardIndex],
          { y: 0 },
          { y: exitDelta, duration: browse.exitBeats, ease: browse.exitEase },
          exitStart + delay,
        );
      });

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

/**
 * Portfolio browse — every knob the grid, the card, and the paging motion
 * read, in one place (same spirit as config/octagon.ts / config/scroll.ts).
 * Split by who consumes what: geometry (px) is read by CSS via
 * browseCssVars(); timing (beats) and behavior are read by GSAP/JS directly.
 *
 * Values below are starting points, not final tuning — the whole reason
 * they live here is to be adjusted from the rendered grid (Steps 6–7), not
 * guessed perfectly now.
 *
 * Exit and entrance are deliberately separate, independently-timed phases,
 * not one shared window: a row's own exit (REST -> OFF-TOP) and the next
 * row's own entrance (PEEK -> REST / OFF-BOTTOM -> PEEK) each have their own
 * duration, and enterDelayBeats controls how much of the exit must elapse
 * before the entrance even begins — set it close to exitBeats for "the next
 * row doesn't move until the current one is nearly gone," or to 0 for the
 * two happening together. Every row shares the same exitEase/enterEase —
 * per-row easing was never on offer, by design.
 */
import type { GsapEase } from "@motion/timeline-kit";

export interface BrowseConfig {
  columns: number; // cards per row

  // ── Card geometry (px) — uniform across every project ──
  cardWidth: number;
  cardHeight: number; // fixed; copy is cut to fit (uniform cards)
  imageHeight: number; // image region; the text block fills the remainder

  // ── Gutters (px) ──
  rowGutter: number; // vertical gap between rows (stays constant between rows)
  colGutter: number; // horizontal gap between columns

  // ── Vertical placement ──
  dwellTop: number; // fraction of the mat's VISIBLE height (below the nav/logo inset,
  // above the bottom inset) where the resting row's top sits — 0 = flush
  // with the mat's own top edge, not the viewport's
  peek: number; // px of the next row left visible below the resting row

  // ── Scroll timing (beats) — consumed by the motion, not CSS ──
  dwellBeats: number; // pause before a row's own exit begins (0 = it leaves the instant scrolling starts)
  exitBeats: number; // duration of a row's own exit (REST -> OFF-TOP)
  enterDelayBeats: number; // delay, from the START of the exit, before the next row's entrance begins
  enterBeats: number; // duration of the next row's own entrance (PEEK -> REST, and OFF-BOTTOM -> PEEK)
  exitEase: GsapEase; // shared easing for every row's own exit
  enterEase: GsapEase; // shared easing for every row's own entrance (and the first-load reveal)

  // ── First-load reveal (fade + rise) ──
  reveal: {
    delayBeats: number; // seconds — 0 = immediate; >0 = hold before row 0 reveals
    rowStaggerBeats: number; // seconds — extra delay before row 1 reveals, after row 0 starts
    overBeats: number; // seconds — duration of each row's own reveal
    rise: number; // px the cards rise from as they fade in
  };

  // ── Exit behavior ──
  clipToBand: boolean; // false = leaving rows slide off-top under the nav; true = clip at a rectangular band
}

export const browse: BrowseConfig = {
  columns: 3,
  cardWidth: 360,
  cardHeight: 405, // fits the longest real description (3 lines, line-clamp-3'd)
  // with room to spare — measured, not guessed (was 420, which left ~80px of
  // dead space below the button on every card whose copy was shorter than
  // the 3-line max; p-6's own 24px bottom padding is the intended gap).
  imageHeight: 190,
  rowGutter: 40,
  colGutter: 40,
  dwellTop: 0.15,
  peek: 60,
  dwellBeats: 0.5,
  exitBeats: 0.4,
  enterDelayBeats: 0.32, // ~80% through the exit — the next row starts once the current one is nearly gone
  enterBeats: 0.4,
  exitEase: "power2.in",
  enterEase: "power2.out",
  reveal: { delayBeats: 0.5, rowStaggerBeats: 0.3, overBeats: 1, rise: 100 },
  clipToBand: false,
};

/**
 * How many beats one page's "moving part" takes — long enough to cover
 * both the exiting row's own exit and the (independently delayed) next
 * row's own entrance, whichever finishes later. Shared by motion.ts (to
 * place each row's tweens) and work.script.ts (to derive the chapter's
 * total scroll length) so the two can never drift out of sync — same
 * reason browseCssVars() is the one place geometry becomes CSS vars.
 */
export function advancePhaseLength(c: BrowseConfig = browse): number {
  return Math.max(c.exitBeats, c.enterDelayBeats + c.enterBeats);
}

/** The geometry CSS needs, as custom properties. Timing/behavior stay JS-only.
    Steps 5–6 spread this onto the card/grid container; CSS reads var(--browse-*). */
export function browseCssVars(
  c: BrowseConfig = browse,
): Record<string, string> {
  return {
    "--browse-columns": String(c.columns),
    "--browse-card-width": `${c.cardWidth}px`,
    "--browse-card-height": `${c.cardHeight}px`,
    "--browse-image-height": `${c.imageHeight}px`,
    "--browse-row-gutter": `${c.rowGutter}px`,
    "--browse-col-gutter": `${c.colGutter}px`,
  };
}

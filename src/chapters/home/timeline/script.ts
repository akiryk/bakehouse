/**
 * Chapter 2 — THE TWEAK FILE.
 *
 * The storyboard is a flat sequence of at(beat, ...moments) entries.
 * `beat` is an absolute position in this script's scope (0 = script start).
 * Moments in the same entry start together.
 *
 * Units: beats. 1 beat = CONFIG.vhPerBeat viewport-heights of scroll.
 * Add ?beats to the URL for the live HUD *and* a console table of the full
 * resolved schedule (absolute start/end of every moment — the ground truth).
 *
 * Editing ripple: use plain TS consts to name anchor points, then reference
 * them across entries so a single change ripples through.
 */

import {
  defineScript,
  at,
  show,
  hide,
  hold,
  travel,
  stopTimelineAt,
} from "@motion/timeline-kit";

// ─── Geometry & feel ──────────────────────────────────────────────────────────

export const CONFIG = {
  firstYear: 1993,
  lastYear: 2026,

  /** vh of tape per year — bigger = years further apart, slower ticking */
  pitch: 26,

  /** where the current year sits on screen (0 top … 1 bottom) */
  anchor: 0.5,

  /** how far below its resting spot the tape enters from, in vh */
  enterFrom: 100,
};

// ─── Year annotations (riders — they live on the tape and scroll with it) ────
// Add a note to any year and it appears beside it, fading in/out at the
// viewport edges automatically (the dissolve is a CSS mask — no choreography).

export const NOTES: Record<number, string> = {
  1995: "Build first-generation sites for non-profits around SF Bay Area",
  1997: "Study interaction design at California College of the Arts",
  2005: "Lead design at a small product studio",
  2016: "Bakehouse Studio opens in Durango",
};

// ─── The storyboard ───────────────────────────────────────────────────────────

export const SCRIPT = defineScript({
  config: CONFIG,
  sequence: [
    at(
      0,
      show("intro", {
        over: 0.5,
        from: { opacity: 0, y: 300 },
        ease: "sine.out",
      }),
    ),

    // Line rises in 0.5 beats after intro settles; tape begins traveling simultaneously.
    at(
      1.0,
      show("line", {
        over: 0.5,
        from: { opacity: 1, y: "100vh" },
        to: { opacity: 1, y: 0 },
        ease: "power2.out",
      }),
    ),

    at(2, hide("intro", { over: 0.5 })),

    at(
      2,
      stopTimelineAt(1995, {
        dwell: 3,
      }),
    ),

    // First project stop: WineSmarts at 2000.
    at(
      5,
      stopTimelineAt(2000, {
        dwell: 2,
        reveal: [
          {
            id: "winesmarts",
            from: { opacity: 0, y: 100 },
            to: { y: 50 },
          },
        ],
      }),
    ),

    // A quick zip forward…
    at(6, travel({ to: 2010, over: 1.25, ease: "power1.inOut" })),

    // …into a second stop, demonstrating a different reveal position/size.
    at(6.15, stopTimelineAt(2011, { dwell: 2.5, reveal: ["sample-2011"] })),

    // Cruise to the present, then a beat of rest to close the chapter.
    at(9.4, travel({ to: 2026, over: 4 })),
    at(13.4, hold(1)),
  ],
});

/**
 * Chapter 2 — THE TWEAK FILE.
 *
 * Everything about how this chapter feels lives here: the tape geometry, the
 * year annotations, and the storyboard. Edit numbers, save, scroll. Nothing
 * else needs touching — Content.astro renders the years from this file, and
 * motion.ts compiles the storyboard.
 *
 * Units: beats. 1 beat = CONFIG.vhPerBeat viewport-heights of scroll.
 * Add ?beats to the URL for a live playhead/year readout while tuning.
 */

import {
  defineScript,
  show,
  hide,
  hold,
  enterTape,
  travel,
  stopTimelineAt,
  morph,
} from "../../../motion/timeline-kit";

// ─── Geometry & feel ──────────────────────────────────────────────────────────

export const CONFIG = {
  firstYear: 1993,
  lastYear: 2026,

  /** vh of tape per year — bigger = years further apart, slower ticking */
  pitch: 26,

  /** where the current year sits on screen (0 top … 1 bottom) */
  anchor: 0.5,

  /** scroll feel — vh of real scrolling per beat. Raise to slow everything. */
  vhPerBeat: 100,

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
// Moments run in order. `withPrevious: true` starts a moment alongside the one
// before it; `offset` (beats) nudges it. stopTimelineAt() handles the whole
// stop-highlight-reveal-dwell-release arc in one call.

export const SCRIPT = defineScript({
  config: CONFIG,
  moments: [
    // 1 — a breath after the chapter arrives, THEN the intro fades in
    //     (centered) and dwells long enough to read
    hold(1), //  ← breath before it appears (raise to delay the intro)
    show("intro", {
      // animate intro from a to b over n beats. And a beat = 100vh.
      // So show "intro" over n lengths of the browser viewport.
      over: 3,
      from: { opacity: 0, y: 300 },
      ease: "sine.out",
    }),
    hold(5), //  ← how long the intro sits still (raise to linger longer)

    // The line rises while the intro remains fully visible.
    show("line", {
      over: 1.5,
      from: { opacity: 1, y: "100vh" },
      to: { opacity: 1, y: 0 },
      ease: "power2.out",
    }),

    // The years begin rising while the intro is still visible.
    enterTape({
      at: 1995,
      over: 4,
      fromOffset: 240,
      fromOpacity: 1,
      toOpacity: 1,
      ease: "power3.out",
    }),

    // Fade the intro during the year entrance.
    // Because this follows enterTape(), withPrevious refers to enterTape().
    hide("intro", {
      over: 1.5,
      withPrevious: true,
      offset: 2,
    }),

    // The tape has arrived at 1995. Pause there.
    stopTimelineAt(1995, {
      dwell: 4,
    }),

    // 5 — years tick by; 1995 and 1997 notes ride past
    travel({ to: 2002, over: 3.5 }),

    // 4 — first project stop: WineSmarts at 2002
    stopTimelineAt(2002, { dwell: 8, reveal: ["winesmarts"] }),

    // a quick zip forward…
    travel({ to: 2010, over: 1.25, ease: "power1.inOut" }),

    // …into a second stop, demonstrating a different reveal position/size
    stopTimelineAt(2011, { dwell: 2.5, reveal: ["sample-2011"] }),

    // cruise to the present and rest
    travel({ to: 2026, over: 4 }),
    hold(1),
  ],
});

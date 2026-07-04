/**
 * Chapter 2 — THE TWEAK FILE.
 *
 * The storyboard is a flat sequence. Each entry starts relative to the
 * PREVIOUS entry:
 *   sinceStart(n, ...moments)  → n beats after the previous entry STARTED
 *   sinceEnd(n, ...moments)    → n beats after the previous entry ENDED
 *                                (bare sinceEnd(...) = the moment it ends)
 * Moments in the same entry start together. Negative gaps are allowed.
 *
 * Units: beats. 1 beat = CONFIG.vhPerBeat viewport-heights of scroll.
 * Add ?beats to the URL for the live HUD *and* a console table of the full
 * resolved schedule (absolute start/end of every moment — the ground truth).
 */

import {
  defineScript,
  sinceStart,
  sinceEnd,
  show,
  hide,
  hold,
  enterTape,
  travel,
  stopTimelineAt,
  morph,
} from "@motion/timeline-kit";

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

export const SCRIPT = defineScript({
  config: CONFIG,
  sequence: [
    // A one-beat breath, then the intro fades up (centered) —
    // a beat = 100vh, so this rise plays out over 3 viewport-lengths of scroll.
    sinceStart(
      5,
      show("intro", {
        over: 3,
        from: { opacity: 0, y: 300 },
        ease: "sine.out",
      }),
    ),

    // 5 beats after the intro settles, the line rises while the intro
    // remains fully visible.
    sinceEnd(
      5,
      show("line", {
        over: 1.5,
        from: { opacity: 1, y: "100vh" },
        to: { opacity: 1, y: 0 },
        ease: "power2.out",
      }),
    ),

    // The moment the line settles, the years begin rising — intro still up.
    sinceEnd(
      enterTape({
        at: 1995,
        over: 4,
        fromOffset: 240,
        fromOpacity: 1,
        toOpacity: 1,
        ease: "power3.out",
      }),
    ),

    // 2 beats into the years' rise, the intro fades away.
    sinceStart(2, hide("intro", { over: 1.5 })),

    // The tape arrives at 1995 as the intro finishes leaving (+0.5) — pause
    // there. (Check the ?beats table: this lands exactly at enterTape's end.)
    sinceEnd(0.5, stopTimelineAt(1995, { dwell: 4 })),

    // Years tick by; the 1995 and 1997 notes ride past.
    sinceEnd(travel({ to: 2002, over: 3.5 })),

    // First project stop: WineSmarts at 2002.
    sinceEnd(stopTimelineAt(2002, { dwell: 8, reveal: ["winesmarts"] })),

    // A quick zip forward…
    sinceEnd(travel({ to: 2010, over: 1.25, ease: "power1.inOut" })),

    // …into a second stop, demonstrating a different reveal position/size.
    sinceEnd(stopTimelineAt(2011, { dwell: 2.5, reveal: ["sample-2011"] })),

    // Cruise to the present, then a beat of rest to close the chapter.
    sinceEnd(travel({ to: 2026, over: 4 })),
    sinceEnd(hold(1)),
  ],
});

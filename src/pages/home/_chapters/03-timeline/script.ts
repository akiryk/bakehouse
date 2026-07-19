/**
 * Chapter 2 — geometry/feel config + wiring.
 *
 * CONFIG below is the tape's geometry (year range, spacing, anchor
 * position, entrance parking). The actual storyboard — what happens when,
 * intro/line/tape entrance timing, and how project stops are placed — lives
 * in timeline-sequence.ts (SEQUENCE, imported below). Project content and
 * per-project motion overrides (dwell, entrance/exit speed/easing/distance,
 * position) live in timeline-content.ts. Three files, three concerns:
 * this one is geometry, timeline-sequence.ts is *when*, timeline-content.ts
 * is *what* and *how each project feels*.
 *
 * Add ?beats to the URL for the live HUD and a console table of the full
 * resolved schedule (absolute start/end of every moment) — the ground
 * truth while tuning.
 */

import { defineScript } from "@components/timeline/motion-script";
import { SEQUENCE } from "./timeline-sequence";

// ─── Geometry & feel ──────────────────────────────────────────────────────────

export const CONFIG = {
  firstYear: 1997,
  lastYear: 2026,

  /** vh of tape per year — bigger = years further apart, slower ticking */
  pitch: 32,

  /** where the current year sits on screen (0 top … 1 bottom) */
  anchor: 0.45,

  /**
   * How far past the viewport's bottom edge the tape parks before its
   * entrance, in vh — compile() computes the park position as
   * yFor(firstYear) + enterFrom (see its own comment), and yFor(firstYear)
   * === anchor*100. The tape is only guaranteed hidden once
   * yFor(firstYear) + enterFrom > 100 (viewport bottom), i.e. enterFrom >
   * 100 - anchor*100 for whatever anchor currently is. If anchor changes,
   * re-check this value stays above that threshold — it's a manual-sync
   * point, not something compile() re-derives for you.
   */
  enterFrom: 55,
};

// ─── Wiring ───────────────────────────────────────────────────────────────────

export const SCRIPT = defineScript({
  config: CONFIG,
  sequence: SEQUENCE,
});

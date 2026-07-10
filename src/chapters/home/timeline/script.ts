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
 *
 * Project stops (Epic 18): each of PROJECTS (projects.ts) gets one
 * stopTimelineAt, placed back to back by placeProjectStops() below rather
 * than nine hand-computed beat offsets. Content (year/title/image/size) and
 * timing (dwellBeats, if a project wants to override DEFAULT_DWELL_BEATS)
 * both live in projects.ts — this file only decides *where in the
 * sequence* the whole run of stops starts.
 */

import {
  defineScript,
  at,
  show,
  hide,
  hold,
  enterTape,
  stopTimelineAt,
  type SequenceEntry,
} from "@motion/timeline-kit";
import { PROJECTS, DEFAULT_DWELL_BEATS, type Project } from "./projects";

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

// ─── Project stops ────────────────────────────────────────────────────────────

/**
 * Beats to ease into a stop that's a different year from wherever the tape
 * currently is — passed explicitly on every generated stopTimelineAt call
 * so this helper's cumulative math can never silently drift from what the
 * compiler actually places. stopTimelineAt's own internal default is also
 * 0.75, but relying on that implicitly would mean two places having to
 * agree by coincidence rather than by construction.
 */
const APPROACH_BEATS = 0.75;

/**
 * Places one stopTimelineAt per project, back to back in chronological
 * order — project N's stop begins right where project N-1's ended (its own
 * approach + dwell). No explicit travel() between stops: stopTimelineAt
 * always eases directly from wherever the tape currently is to its target
 * year over `approach` beats (see timeline-kit.ts's compile()), so chaining
 * stops with no dead scroll between them is enough for a first pass.
 */
function placeProjectStops(
  projects: Project[],
  startBeat: number,
): { entries: SequenceEntry[]; endBeat: number } {
  let beat = startBeat;
  const entries: SequenceEntry[] = [];
  for (const project of projects) {
    const dwell = project.dwellBeats ?? DEFAULT_DWELL_BEATS;
    entries.push(
      at(
        beat,
        stopTimelineAt(project.year, {
          approach: APPROACH_BEATS,
          dwell,
          reveal: [String(project.year)],
        }),
      ),
    );
    beat += APPROACH_BEATS + dwell;
  }
  return { entries, endBeat: beat };
}

/**
 * The tape's initial entrance — rises into view and lands on
 * TAPE_ENTER_YEAR, continuous with the rest of the scroll. No dwell/pause
 * here: unlike project stops, which deliberately pause, notes are meant to
 * just go by as the tape travels past them. This used to be a
 * stopTimelineAt(1995, { dwell: 3 }) with no reveal — a genuine pause on a
 * note year, which is exactly what "notes just go by" rules out.
 *
 * Landing year moved from 1995 to 1997 (2 years later, per request) —
 * conveniently the tape now lands right as NOTES[1997] itself is showing,
 * rather than an arbitrary blank year. NOTES[1995] still exists and still
 * appears — it just sweeps past during the rise instead of getting its own
 * stop, same as every other note.
 */
const TAPE_ENTER_BEAT = 2;
const TAPE_ENTER_YEAR = 1997;
const TAPE_ENTER_OVER = 2;

/** Right where the tape's entrance finishes. */
const PROJECTS_START_BEAT = TAPE_ENTER_BEAT + TAPE_ENTER_OVER;

const { entries: projectStops, endBeat: projectsEndBeat } = placeProjectStops(
  PROJECTS,
  PROJECTS_START_BEAT,
);

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

    at(TAPE_ENTER_BEAT, hide("intro", { over: 0.5 })),

    // Tape rises into view and lands on TAPE_ENTER_YEAR — no dwell (see the
    // comment above). fromOffset isn't set here; it falls back to
    // CONFIG.enterFrom (100vh), which is what this already used implicitly.
    at(
      TAPE_ENTER_BEAT,
      enterTape({ at: TAPE_ENTER_YEAR, over: TAPE_ENTER_OVER }),
    ),

    // One stopTimelineAt per project (see PROJECTS in projects.ts),
    // chronological, back to back — no per-project hand-placed beat.
    ...projectStops,

    // Trailing rest, right after the last project's own stop ends. 2026
    // (Rainday, the last project) matches CONFIG.lastYear exactly, so this
    // is already the tape's true end — no travel() to a later year needed,
    // unlike the old two-example script.
    at(projectsEndBeat, hold(1)),
  ],
});
